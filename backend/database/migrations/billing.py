from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from backend.database.db import Base

ENTRY_TYPES = ("fee", "expense", "payment")
ENTRY_STATUSES = ("pending", "approved", "rejected", "voided")


class BillingEntry(Base):
    __tablename__ = "billing_entries"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id", ondelete="SET NULL"), nullable=True, index=True)

    entry_type = Column(String(20), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)          # PKR, always positive
    entry_date = Column(Date, nullable=False, index=True)
    description = Column(String(500), nullable=False)
    reference = Column(String(100), nullable=True)           # receipt / cheque / invoice no.
    payment_method = Column(String(30), nullable=True)       # cash, bank transfer, cheque… (payments)
    billable = Column(Boolean, nullable=False, default=True, server_default="true")  # expenses: recover from client?

    # Maker-checker
    status = Column(String(20), nullable=False, default="pending", index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)                # rejection / void reason
    self_approved = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
