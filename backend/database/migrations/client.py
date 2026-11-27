from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.db import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    cnic = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    matters = relationship("Matter", back_populates="client", cascade="all, delete-orphan")


class Matter(Base):
    __tablename__ = "matters"

    id = Column(Integer, primary_key=True, index=True)
    firm_id = Column(Integer, ForeignKey("firms.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    case_number = Column(String(100), nullable=True)
    court = Column(String(200), nullable=True)
    status = Column(String(20), nullable=False, default="open")
    description = Column(Text, nullable=True)

    # Court record — typed by hand or fetched from the court's website (services/court_lookup.py)
    district = Column(String(60), nullable=True)
    court_type = Column(String(100), nullable=True)
    judge = Column(String(300), nullable=True)
    category = Column(String(200), nullable=True)
    stage = Column(String(200), nullable=True)
    filed_on = Column(Date, nullable=True)            # register / institution date
    next_hearing = Column(Date, nullable=True)
    fir_number = Column(String(40), nullable=True)
    fir_year = Column(String(4), nullable=True)
    police_station = Column(String(120), nullable=True)
    source = Column(String(40), nullable=True)        # manual | punjab_district_portal | lhc_case_status
    source_url = Column(String(500), nullable=True)
    synced_at = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    client = relationship("Client", back_populates="matters")
