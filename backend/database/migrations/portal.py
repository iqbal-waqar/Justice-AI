from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.db import Base


class CaseShare(Base):
    """A case (matter) a lawyer has shared with a client, identified by the client's email.
    The client signs in to the portal with an email code and sees the hearings, fees and
    receipts of every case shared with that address. Revoking sets revoked_at."""
    __tablename__ = "case_shares"
    __table_args__ = (UniqueConstraint("matter_id", "client_email", name="uq_case_share_matter_email"),)

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True)
    client_email = Column(String(255), nullable=False, index=True)
    shared_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    matter = relationship("Matter")
    sharer = relationship("User", foreign_keys=[shared_by])


class ClientLogin(Base):
    """Sign-in state for a client email: the current one-time code and its limits."""
    __tablename__ = "client_logins"

    email = Column(String(255), primary_key=True)
    code_hash = Column(String(64), nullable=True)
    code_expires_at = Column(DateTime(timezone=True), nullable=True)
    code_sent_at = Column(DateTime(timezone=True), nullable=True)
    code_attempts = Column(Integer, default=0, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
