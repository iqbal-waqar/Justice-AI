from sqlalchemy import Column, Date, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from backend.database.db import Base


class DailyTip(Base):
    """One legal tip per day and language, written from a passage in the research corpus
    (services/daily_tip.py) and sent every morning by email and WhatsApp."""
    __tablename__ = "daily_tips"
    __table_args__ = (UniqueConstraint("tip_date", "lang", name="uq_daily_tip_date_lang"),)

    id = Column(Integer, primary_key=True, index=True)
    tip_date = Column(Date, nullable=False, index=True)
    lang = Column(String(2), nullable=False, default="en")          # en | ur
    theme = Column(String(120), nullable=False)                     # the area of law the day covers
    title = Column(String(160), nullable=False)
    body = Column(Text, nullable=False)                             # two or three sentences
    takeaway = Column(String(300), nullable=True)                   # the one line to remember
    question = Column(String(300), nullable=False)                  # tap to ask Justice AI
    source_title = Column(String(300), nullable=True)
    source_citation = Column(String(200), nullable=True)
    source_court = Column(String(120), nullable=True)
    source_year = Column(String(10), nullable=True)
    source_url = Column(String(600), nullable=True)
    source_doc_type = Column(String(40), nullable=True)
    sent_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
