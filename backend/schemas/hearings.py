from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, time

class HearingCreate(BaseModel):
    case_title: str
    matter_id: Optional[int] = None
    case_number: Optional[str] = None
    court: Optional[str] = None
    hearing_date: date
    hearing_time: Optional[str] = None
    notes: Optional[str] = None
    notify_phone: Optional[str] = None
    status: Optional[str] = "upcoming"

class HearingUpdate(BaseModel):
    case_title: Optional[str] = None
    matter_id: Optional[int] = None
    case_number: Optional[str] = None
    court: Optional[str] = None
    hearing_date: Optional[date] = None
    hearing_time: Optional[str] = None
    notes: Optional[str] = None
    notify_phone: Optional[str] = None
    status: Optional[str] = None

class HearingResponse(BaseModel):
    id: int
    case_title: str
    matter_id: Optional[int] = None
    case_number: Optional[str]
    court: Optional[str]
    hearing_date: date
    hearing_time: Optional[str]
    notes: Optional[str]
    notify_phone: Optional[str] = None
    status: str
    reminder_sent: Optional[str] = None

    @field_validator("hearing_time", mode="before")
    @classmethod
    def time_to_string(cls, v):
        if isinstance(v, time):
            return v.strftime("%H:%M")
        return v

    class Config:
        from_attributes = True
