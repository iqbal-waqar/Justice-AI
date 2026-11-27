"""Daily legal tip: today's tip and the archive. Delivery is automatic (services/daily_tip.py, 10:00 PKT)."""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.database.migrations.daily_tip import DailyTip
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.services.daily_tip import daily_tip_service

router = APIRouter(prefix="/tips")


class TipOut(BaseModel):
    id: int
    tip_date: date
    lang: str
    theme: str
    title: str
    body: str
    takeaway: Optional[str]
    question: str
    source_title: Optional[str]
    source_citation: Optional[str]
    source_court: Optional[str]
    source_year: Optional[str]
    source_url: Optional[str]
    source_doc_type: Optional[str]

    class Config:
        from_attributes = True


@router.get("/today", response_model=TipOut)
def today(lang: Optional[str] = None, user: User = Depends(auth_interactor.resolve_current_user), db: Session = Depends(get_db)):
    lang = lang if lang in ("en", "ur") else (user.tip_language or "en")
    try:
        return daily_tip_service.ensure_tip(date.today(), lang, db)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Today's tip could not be written: {exc.__class__.__name__}")


@router.get("", response_model=List[TipOut])
def archive(lang: Optional[str] = None, limit: int = 30, user: User = Depends(auth_interactor.resolve_current_user), db: Session = Depends(get_db)):
    lang = lang if lang in ("en", "ur") else (user.tip_language or "en")
    return db.query(DailyTip).filter(DailyTip.lang == lang).order_by(DailyTip.tip_date.desc()).limit(min(limit, 90)).all()
