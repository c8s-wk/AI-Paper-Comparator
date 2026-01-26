# backend/init_db.py
from database.core import engine, Base
from database.models import Document, ComparisonTask
from database.vector_store import vector_db_client

def init_database():
    print("🔄 Initializing Relational Database (SQLite)...")
    # 这句话会根据 models.py 自动创建表结构
    Base.metadata.create_all(bind=engine)
    print("✅ SQL Tables created successfully!")

    print("🔄 Initializing Vector Database (ChromaDB)...")
    # 这里的 vector_db_client 实例化时就会自动创建文件夹
    print(f"✅ Vector Collection '{vector_db_client.collection.name}' is ready.")
    print("🚀 Database Setup Complete.")

if __name__ == "__main__":
    init_database()