# backend/services/pdf_processor.py
import fitz  # PyMuPDF
import os
from sqlalchemy.orm import Session
from database.models import Document, ProcessStatus
from database.vector_store import vector_db_client

def parse_pdf(file_path: str):
    """
    使用 PyMuPDF 提取 PDF 文本，返回文本列表（按页）
    """
    doc = fitz.open(file_path)
    text_chunks = []
    metadatas = []

    for page_num, page in enumerate(doc):
        text = page.get_text()
        if len(text.strip()) < 50:  # 跳过几乎空白的页面
            continue
        
        # 简单的切片策略：每一页作为一个 Chunk
        # 进阶优化：这里应该使用 LangChain 的 RecursiveCharacterTextSplitter 进行更细致的切分
        text_chunks.append(text)
        metadatas.append({"page": page_num + 1})
        
    return text_chunks, metadatas

def process_document_background(doc_id: int, file_path: str, db: Session):
    """
    后台任务：解析 PDF -> 向量化 -> 更新数据库状态
    """
    try:
        print(f"🔄 [Task] Start processing Document ID: {doc_id}")
        
        # 1. 更新状态为 Processing
        doc_record = db.query(Document).filter(Document.id == doc_id).first()
        doc_record.status = ProcessStatus.PROCESSING
        db.commit()

        # 2. 解析 PDF
        texts, metadatas = parse_pdf(file_path)
        print(f"📄 Extracted {len(texts)} pages from PDF.")

        # 3. 存入向量数据库 (ChromaDB)
        # 注意：这里会自动调用 Embedding 模型，可能会花几秒钟
        vector_db_client.add_documents(doc_id, texts, metadatas)

        # 4. 标记为完成
        doc_record.status = ProcessStatus.COMPLETED
        db.commit()
        print(f"✅ [Task] Document ID {doc_id} processed successfully!")

    except Exception as e:
        print(f"❌ [Task] Error processing document: {e}")
        doc_record = db.query(Document).filter(Document.id == doc_id).first()
        doc_record.status = ProcessStatus.FAILED
        doc_record.error_message = str(e)
        db.commit()
    finally:
        db.close() # 务必关闭后台任务独立的 Session