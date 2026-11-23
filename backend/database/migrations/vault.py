from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from backend.database.db import Base

VAULT_CATEGORIES = ("petition", "order", "judgment", "evidence", "correspondence", "agreement", "identity", "other")


class VaultDocument(Base):
    __tablename__ = "vault_documents"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    category = Column(String(30), nullable=False, default="other")
    description = Column(Text, nullable=True)
    original_filename = Column(String(300), nullable=False)
    content_type = Column(String(120), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_key = Column(String(300), nullable=False, unique=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class VaultAuditLog(Base):
    __tablename__ = "vault_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, nullable=True, index=True)
    document_title = Column(String(300), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(20), nullable=False)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
