from sqlalchemy import Column, Integer, String, Date, Time, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from backend.database.db import Base


class Hearing(Base):
    __tablename__ = "hearings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    case_title = Column(String(300), nullable=False)
    case_number = Column(String(100), nullable=True)
    court = Column(String(200), nullable=True)
    hearing_date = Column(Date, nullable=False, index=True)
    hearing_time = Column(Time, nullable=True)
    notes = Column(Text, nullable=True)

    notify_phone = Column(String(20), nullable=True)
    matter_id = Column(Integer, ForeignKey("matters.id", ondelete="SET NULL"), nullable=True, index=True)

    status = Column(String(20), nullable=False, default="upcoming")

    reminder_sent = Column(String(20), nullable=True, default=None)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="hearings")
