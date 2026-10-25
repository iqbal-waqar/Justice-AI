from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from backend.database.db import Base


class UserDocument(Base):
    __tablename__ = "user_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    filename = Column(String, nullable=False)          
    original_name = Column(String, nullable=False)   
    file_size = Column(Integer, default=0)           
    page_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)

    status = Column(String, default="processing")     
    error_message = Column(Text, nullable=True)

    qdrant_doc_id = Column(String, nullable=False, unique=True) 

    created_at = Column(DateTime(timezone=True), server_default=func.now())
