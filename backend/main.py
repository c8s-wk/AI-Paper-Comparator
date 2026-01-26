# backend/main.py
import shutil
import os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database.core import get_db, Base, engine
from database.models import Document, ProcessStatus
from services.pdf_processor import process_document_background

from database.models import ComparisonTask
from services.comparator import run_compare_task
from pydantic import BaseModel

# Load environment variables from .env if present
load_dotenv()

# 定义请求体结构
class CompareRequest(BaseModel):
    source_doc_id: int
    target_doc_id: int

# 确保上传目录存在
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="AI Paper Comparator")

# Ensure database tables exist on startup to avoid missing-table errors
@app.on_event("startup")
def on_startup_create_tables():
    Base.metadata.create_all(bind=engine)

# 配置 CORS，允许前端（稍后开发的 React）访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "API is running!"}

@app.post("/api/upload")
def upload_file(
    background_tasks: BackgroundTasks, # FastAPI 的后台任务神器
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    # 1. 保存文件到本地磁盘
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 2. 在 SQL 数据库创建记录
    new_doc = Document(
        filename=file.filename,
        file_path=file_location,
        status=ProcessStatus.PENDING
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # 3. 触发后台处理任务 (解析 + 向量化)
    # 注意：我们要传一个新的 db session 给后台任务，或者是让后台任务自己创建 Session
    # 为了简单，我们这里让 helper function 自己管理 Session，所以不需要传 db
    # 但是前面的 process_document_background 需要一个 session。
    # 修正策略：在 background task 里重新生成一个 SessionLocal() 比较安全，或者直接传 ID 让其处理。
    
    # 这里的技巧：BackgroundTasks 运行在 Response 返回之后。
    # 我们需要传递一个新的 Session 给它，或者让它在内部新建 Session。
    # 简单起见，我们在 pdf_processor.py 里修改一下，让它接受 sessionmaker 或者我们直接在这里传
    # 更好的做法：由于 Session 不能跨线程简单共享，我们让后台任务自己创建 Session。
    
    from database.core import SessionLocal
    background_db = SessionLocal() 
    background_tasks.add_task(process_document_background, new_doc.id, file_location, background_db)

    return {
        "id": new_doc.id, 
        "filename": new_doc.filename, 
        "status": "upload_success_processing_started"
    }

@app.get("/api/documents")
def list_documents(db: Session = Depends(get_db)):
    """列出所有上传的文档及其状态"""
    docs = db.query(Document).order_by(Document.upload_time.desc()).all()
    return docs

@app.get("/api/documents/{doc_id}")
def get_document_status(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"id": doc.id, "status": doc.status, "error": doc.error_message}

@app.post("/api/compare")
def start_comparison(
    request: CompareRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """
    创建一个对比任务，并在后台开始计算
    """
    # 1. 检查文档是否存在
    source = db.query(Document).filter(Document.id == request.source_doc_id).first()
    target = db.query(Document).filter(Document.id == request.target_doc_id).first()
    
    if not source or not target:
        raise HTTPException(status_code=404, detail="One or both documents not found")

    if source.status != ProcessStatus.COMPLETED or target.status != ProcessStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Documents are not yet processed (embedded).")

    # 2. 创建任务记录
    new_task = ComparisonTask(
        source_doc_id=source.id,
        target_doc_id=target.id,
        status=ProcessStatus.PENDING
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # 3. 触发后台算法
    background_tasks.add_task(run_compare_task, new_task.id)

    return {"task_id": new_task.id, "status": "queued"}

@app.get("/api/compare/{task_id}")
def get_comparison_result(task_id: int, db: Session = Depends(get_db)):
    """
    轮询接口：查看对比进度和结果
    """
    task = db.query(ComparisonTask).filter(ComparisonTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": task.id,
        "status": task.status,
        "created_at": task.created_at,
        "result": task.result_json # 如果完成了，这里会有大段 JSON 数据
    }
