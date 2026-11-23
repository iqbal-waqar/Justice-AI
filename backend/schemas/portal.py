from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# ── sharing a case with a client ──────────────────────────────────────────────

class CaseShareIn(BaseModel):
    email: EmailStr


class CaseShareOut(BaseModel):
    id: int
    matter_id: int
    client_email: str
    shared_by_name: Optional[str] = None
    created_at: datetime
    revoked_at: Optional[datetime] = None


# ── client sign-in (email code) ───────────────────────────────────────────────

class ClientCodeRequest(BaseModel):
    email: EmailStr


class ClientVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=8)


class ClientTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


# ── what a client sees ────────────────────────────────────────────────────────

class ClientHearingOut(BaseModel):
    id: int
    hearing_date: date
    hearing_time: Optional[str] = None
    court: Optional[str] = None
    status: str
    notes: Optional[str] = None


class ClientEntryOut(BaseModel):
    id: int
    entry_type: str            # fee | expense | payment
    amount: Decimal
    entry_date: date
    description: str
    reference: Optional[str] = None
    payment_method: Optional[str] = None


class ClientCaseOut(BaseModel):
    share_id: int
    matter_id: int
    title: str
    case_number: Optional[str] = None
    court: Optional[str] = None
    status: str
    description: Optional[str] = None
    client_name: str
    firm_name: str
    lawyer_name: Optional[str] = None
    lawyer_phone: Optional[str] = None
    lawyer_email: Optional[str] = None
    shared_at: datetime
    next_hearing: Optional[date] = None
    hearings: List[ClientHearingOut] = []
    entries: List[ClientEntryOut] = []
    total_fees: Decimal = Decimal("0")
    total_expenses: Decimal = Decimal("0")
    total_paid: Decimal = Decimal("0")
    balance_due: Decimal = Decimal("0")


# ── public lawyer directory ───────────────────────────────────────────────────

class LawyerCardOut(BaseModel):
    id: int
    full_name: str
    city: Optional[str] = None
    practice_areas: List[str] = []
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    courts: Optional[str] = None
    languages: Optional[str] = None
    bar_council_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_picture: Optional[str] = None
    firm_name: Optional[str] = None
    member_since: Optional[datetime] = None


class DirectoryOut(BaseModel):
    lawyers: List[LawyerCardOut]
    cities: List[str]
    areas: List[str]
