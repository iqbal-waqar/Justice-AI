from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from backend.database.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    phone = Column(String(20), nullable=True)
    phone_verified = Column(Boolean, default=False, nullable=False)
    bar_council_id = Column(String(50), nullable=True)
    specialization = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)

    notification_email = Column(String(255), nullable=True)  
    
    profile_picture = Column(String(500), nullable=True) 

    role = Column(String(20), nullable=False, default="lawyer")  
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    hearings = relationship("Hearing", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("CaseNote", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
