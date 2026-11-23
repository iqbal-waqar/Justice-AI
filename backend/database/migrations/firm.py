from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.db import Base

FIRM_ROLES = ("owner", "partner", "associate", "clerk")
APPROVER_ROLES = ("owner", "partner")


class Firm(Base):
    __tablename__ = "firms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    allow_self_approval = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    members = relationship("FirmMember", back_populates="firm", cascade="all, delete-orphan")


class FirmMember(Base):
    __tablename__ = "firm_members"
    __table_args__ = (UniqueConstraint("user_id", name="uq_firm_members_user"),)

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="associate")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    firm = relationship("Firm", back_populates="members")
    user = relationship("User")


class FirmInvitation(Base):
    __tablename__ = "firm_invitations"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="associate")
    status = Column(String(20), nullable=False, default="pending")
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    firm = relationship("Firm")
