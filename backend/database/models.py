# backend/database/models.py
import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
import enum
from .core import Base

# 定义状态枚举，避免代码里出现魔法字符串
class ProcessStatus(str, enum.Enum):
    PENDING = "pending"       # 等待处理
    PROCESSING = "processing" # 正在处理 (解析/向量化中)
    COMPLETED = "completed"   # 完成
    FAILED = "failed"         # 失败

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)      # 原始文件名
    file_path = Column(String, nullable=False)     # 本地存储路径
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    
    # 记录该文档处理到了哪一步
    status = Column(Enum(ProcessStatus), default=ProcessStatus.PENDING)
    # 如果失败，存储错误信息
    error_message = Column(Text, nullable=True)

    # 反向关联
    source_tasks = relationship("ComparisonTask", foreign_keys="[ComparisonTask.source_doc_id]", back_populates="source_doc")
    target_tasks = relationship("ComparisonTask", foreign_keys="[ComparisonTask.target_doc_id]", back_populates="target_doc")

class ComparisonTask(Base):
    __tablename__ = "comparison_tasks"

    id = Column(Integer, primary_key=True, index=True)
    
    # 外键关联两个文档
    source_doc_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    target_doc_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # 任务状态
    status = Column(Enum(ProcessStatus), default=ProcessStatus.PENDING)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # 最重要的字段：存储 JSON 格式的对比报告
    # 例如: {"score": 0.45, "matches": [...]}
    result_json = Column(JSON, nullable=True)

    # 关系属性
    source_doc = relationship("Document", foreign_keys=[source_doc_id], back_populates="source_tasks")
    target_doc = relationship("Document", foreign_keys=[target_doc_id], back_populates="target_tasks")