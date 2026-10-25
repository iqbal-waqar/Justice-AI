from pydantic import BaseModel
from typing import Optional
from datetime import date

class HearingCreate(BaseModel):
    case_title: str
    case_number: Optional[str] = None
    court: Optional[str] = None
    hearing_date: date
    hearing_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "upcoming"

class HearingUpdate(BaseModel):
    case_title: Optional[str] = None
    case_number: Optional[str] = None
    court: Optional[str] = None
    hearing_date: Optional[date] = None
    hearing_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class HearingResponse(BaseModel):
    id: int
    case_title: str
    case_number: Optional[str]
    court: Optional[str]
    hearing_date: date
    hearing_time: Optional[str]
    notes: Optional[str]
    status: str
    reminder_sent: Optional[str] = None

    class Config:
        from_attributes = True
