from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

Money = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]

MemberRole = Literal["partner", "associate", "clerk"]


class FirmUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    allow_self_approval: Optional[bool] = None


class InvitationIn(BaseModel):
    email: EmailStr
    role: MemberRole = "associate"


class MemberUpdate(BaseModel):
    role: MemberRole


class MemberOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    role: str
    joined_at: Optional[datetime] = None


class InvitationOut(BaseModel):
    id: int
    firm_id: int
    firm_name: str
    email: str
    role: str
    status: str
    created_at: Optional[datetime] = None


class FirmOut(BaseModel):
    id: int
    name: str
    allow_self_approval: bool
    my_role: str
    my_user_id: int
    can_approve: bool
    approver_count: int
    members: List[MemberOut]
    sent_invitations: List[InvitationOut] = []
    my_invitations: List[InvitationOut] = []


class ClientIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = None
    cnic: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=2000)
    notes: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("email", mode="before")
    @classmethod
    def blank_email_is_none(cls, v):
        return v or None


class ClientUpdate(ClientIn):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)


class CourtRecordFields(BaseModel):
    """Court details of a case — typed by hand or fetched from the court website."""
    district: Optional[str] = Field(default=None, max_length=60)
    court_type: Optional[str] = Field(default=None, max_length=100)
    judge: Optional[str] = Field(default=None, max_length=300)
    category: Optional[str] = Field(default=None, max_length=200)
    stage: Optional[str] = Field(default=None, max_length=200)
    filed_on: Optional[date] = None
    next_hearing: Optional[date] = None
    fir_number: Optional[str] = Field(default=None, max_length=40)
    fir_year: Optional[str] = Field(default=None, max_length=4)
    police_station: Optional[str] = Field(default=None, max_length=120)
    source: Optional[Literal["manual", "punjab_district_portal", "lhc_case_status"]] = None
    source_url: Optional[str] = Field(default=None, max_length=500)
    assigned_to: Optional[int] = None


class ProceedingIn(BaseModel):
    date: date
    stage: Optional[str] = Field(default=None, max_length=200)
    order: Optional[str] = Field(default=None, max_length=2000)


class MatterIn(CourtRecordFields):
    client_id: Optional[int] = None
    new_client: Optional[ClientIn] = None          # create the client in the same step
    title: str = Field(..., min_length=1, max_length=300)
    case_number: Optional[str] = Field(default=None, max_length=100)
    court: Optional[str] = Field(default=None, max_length=200)
    status: Literal["open", "closed"] = "open"
    description: Optional[str] = Field(default=None, max_length=5000)
    proceedings: List[ProceedingIn] = []            # fetched history to file in the case diary


class MatterUpdate(CourtRecordFields):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    case_number: Optional[str] = Field(default=None, max_length=100)
    court: Optional[str] = Field(default=None, max_length=200)
    status: Optional[Literal["open", "closed"]] = None
    description: Optional[str] = Field(default=None, max_length=5000)
    proceedings: Optional[List[ProceedingIn]] = None


class MatterOut(CourtRecordFields):
    id: int
    client_id: int
    client_name: Optional[str] = None
    title: str
    case_number: Optional[str]
    court: Optional[str]
    status: str
    description: Optional[str]
    synced_at: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    created_at: datetime
    document_count: int = 0
    hearing_count: int = 0

    class Config:
        from_attributes = True


# ── Court lookup (case auto-fill) ──
class CourtLookupIn(BaseModel):
    court: Literal["district", "lhc"]
    case_number: str = Field(..., min_length=1, max_length=60)
    district_id: Optional[int] = Field(default=None, ge=1, le=36)
    bench: Optional[Literal["L", "R", "M", "B"]] = None


class FirLookupIn(BaseModel):
    district_id: int = Field(..., ge=1, le=36)
    fir_number: str = Field(..., min_length=1, max_length=20)
    fir_year: str = Field(..., min_length=4, max_length=4)
    police_station_id: Optional[int] = None


class CauseListIn(BaseModel):
    district_id: int = Field(..., ge=1, le=36)
    court_id: int
    date: date


class ClientOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]
    cnic: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    created_at: datetime
    matters: List[MatterOut] = []
    document_count: int = 0
    balance: Decimal = Decimal("0")

    class Config:
        from_attributes = True


VaultCategory = Literal["petition", "order", "judgment", "evidence", "correspondence", "agreement", "identity", "other"]


class VaultDocumentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    category: Optional[VaultCategory] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    client_id: Optional[int] = None
    matter_id: Optional[int] = None


class VaultDocumentOut(BaseModel):
    id: int
    title: str
    category: str
    description: Optional[str]
    original_filename: str
    content_type: str
    size_bytes: int
    sha256: str
    client_id: Optional[int]
    client_name: Optional[str] = None
    matter_id: Optional[int]
    matter_title: Optional[str] = None
    uploaded_by: Optional[int]
    uploaded_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VaultAuditOut(BaseModel):
    id: int
    document_id: Optional[int]
    document_title: Optional[str]
    user_name: Optional[str]
    action: str
    ip_address: Optional[str]
    created_at: datetime


class VaultStats(BaseModel):
    document_count: int
    total_bytes: int
    storage_backend: str
    encrypted: bool = True


EntryType = Literal["fee", "expense", "payment"]


class BillingEntryIn(BaseModel):
    client_id: int
    matter_id: Optional[int] = None
    entry_type: EntryType
    amount: Money
    entry_date: date
    description: str = Field(..., min_length=1, max_length=500)
    reference: Optional[str] = Field(default=None, max_length=100)
    payment_method: Optional[Literal["cash", "bank_transfer", "cheque", "online", "other"]] = None
    billable: bool = True


class BillingEntryUpdate(BaseModel):
    matter_id: Optional[int] = None
    amount: Optional[Money] = None
    entry_date: Optional[date] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    reference: Optional[str] = Field(default=None, max_length=100)
    payment_method: Optional[Literal["cash", "bank_transfer", "cheque", "online", "other"]] = None
    billable: Optional[bool] = None


class ReviewIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=1000)


class BillingEntryOut(BaseModel):
    id: int
    client_id: int
    client_name: Optional[str] = None
    matter_id: Optional[int]
    matter_title: Optional[str] = None
    entry_type: str
    amount: Decimal
    entry_date: date
    description: str
    reference: Optional[str]
    payment_method: Optional[str]
    billable: bool
    status: str
    created_by: Optional[int]
    created_by_name: Optional[str] = None
    reviewed_by: Optional[int]
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime]
    review_note: Optional[str]
    self_approved: bool
    created_at: datetime
    can_review: bool = False
    can_edit: bool = False


class BillingSummary(BaseModel):
    total_fees: Decimal
    total_expenses: Decimal
    total_payments: Decimal
    outstanding: Decimal
    pending_count: int
    pending_amount: Decimal
    awaiting_my_review: int
    received_this_month: Decimal
