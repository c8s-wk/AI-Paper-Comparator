# backend/database/vector_store.py
import chromadb
from chromadb.config import Settings
import os

class VectorDB:
    def __init__(self, persist_dir="./chroma_db"):
        # 初始化 ChromaDB 客户端，设置持久化存储
        self.client = chromadb.PersistentClient(path=persist_dir)
        
        # 获取或创建集合 (Collection)
        # 类似于 SQL 中的 Table
        self.collection = self.client.get_or_create_collection(
            name="paper_chunks",
            # 这里如果不指定 embedding_function，Chroma 会默认使用内置的 all-MiniLM-L6-v2
            # 如果你要用 OpenAI，后续我们再在这里替换
        )

    def add_documents(self, doc_id: int, texts: list[str], metadatas: list[dict] = None):
        """
        将文档切片存入向量库
        :param doc_id: SQL数据库中的 Document ID (用于关联)
        :param texts: 文本切片列表
        :param metadatas: 每个切片的元数据 (例如页码: {"page": 1})
        """
        if not texts:
            return
            
        # 生成唯一的 chunk id: doc_1_0, doc_1_1, ...
        ids = [f"doc_{doc_id}_{i}" for i in range(len(texts))]
        
        # 确保每个 metadata 都包含 doc_id，方便后续删除或过滤
        if metadatas is None:
            metadatas = [{"doc_id": doc_id} for _ in texts]
        else:
            for meta in metadatas:
                meta["doc_id"] = doc_id

        self.collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
        print(f"✅ Successfully added {len(texts)} chunks for Document ID {doc_id}")

    def search_similar(self, query_text: str, top_k: int = 5):
        """
        根据文本搜索相似片段
        """
        results = self.collection.query(
            query_texts=[query_text],
            n_results=top_k
        )
        return results

    def delete_document(self, doc_id: int):
        """
        如果用户删除了文件，顺便把向量库里的也删了
        """
        self.collection.delete(
            where={"doc_id": doc_id}
        )
    
    def get_document_chunks(self, doc_id: int):
        """
        获取指定文档的所有切片文本和ID
        用于遍历“待测论文”的内容
        """
        result = self.collection.get(
            where={"doc_id": doc_id},
            include=["documents", "metadatas"]
        )
        return result

    def query_context(self, query_text: str, filter_doc_id: int, top_k: int = 1):
        """
        在指定的文档 (filter_doc_id) 中搜索与 query_text 相似的段落
        """
        results = self.collection.query(
            query_texts=[query_text],
            n_results=top_k,
            where={"doc_id": filter_doc_id}, # 关键：只在基准论文里搜
            include=["documents", "metadatas", "distances"] # Chroma返回的是距离，越小越相似
        )
        return results

# 创建一个单例实例供外部调用
vector_db_client = VectorDB()