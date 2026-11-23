from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from backend.database.db import Base

RESOURCE_CATEGORIES = ("General", "Forms", "Rules & Orders", "Petitions", "Applications", "Notices", "Affidavits", "Agreements", "Other")


class LibraryResource(Base):
    __tablename__ = "library_resources"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    category = Column(String(40), nullable=False, default="General")
    tags = Column(Text, nullable=True)
    language = Column(String(20), nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_name = Column(String(80), nullable=False, unique=True)
    size_bytes = Column(Integer, nullable=False, default=0)
    page_count = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
