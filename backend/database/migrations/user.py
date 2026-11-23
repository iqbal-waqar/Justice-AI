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

    email_verified = Column(Boolean, default=False, nullable=False)
    email_code_hash = Column(String(64), nullable=True)
    email_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    email_code_sent_at = Column(DateTime(timezone=True), nullable=True)
    email_code_attempts = Column(Integer, default=0, nullable=False)
    bar_council_id = Column(String(50), nullable=True)
    specialization = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)

    bio = Column(Text, nullable=True)
    practice_areas = Column(String(300), nullable=True)      # comma-separated, e.g. "Criminal, Family"
    experience_years = Column(Integer, nullable=True)
    courts = Column(String(300), nullable=True)              # where the lawyer appears
    languages = Column(String(100), nullable=True)
    directory_listed = Column(Boolean, default=False, nullable=False, server_default="false")

    notification_email = Column(String(255), nullable=True)  
    
    profile_picture = Column(String(500), nullable=True) 

    role = Column(String(20), nullable=False, default="lawyer")  
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    @property
    def practice_area_list(self) -> list:
        return [a.strip() for a in (self.practice_areas or "").split(",") if a.strip()]

    @property
    def directory_complete(self) -> bool:
        """What a lawyer must fill in before appearing in Find a lawyer."""
        return bool((self.full_name or "").strip() and (self.city or "").strip() and self.practice_area_list
                    and len((self.bio or "").strip()) >= 40 and ((self.phone or "").strip() or self.email))

    hearings = relationship("Hearing", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("CaseNote", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
