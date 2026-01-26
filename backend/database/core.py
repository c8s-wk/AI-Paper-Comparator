# backend/database/core.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# 使用 SQLite，数据文件名为 app.db
DATABASE_URL = "sqlite:///./app.db"

# connect_args={"check_same_thread": False} 是 SQLite 必须的配置，用于多线程环境（FastAPI）
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=False # 设为 True 可以看到生成的 SQL 语句，方便调试
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# 依赖注入函数 (用于 FastAPI)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()