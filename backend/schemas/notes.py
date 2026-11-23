from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["low", "normal", "high"]


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    case_ref: Optional[str] = Field(default=None, max_length=100)
    content: str = Field(..., min_length=1)
    priority: Priority = "normal"


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    case_ref: Optional[str] = Field(default=None, max_length=100)
    content: Optional[str] = Field(default=None, min_length=1)
    priority: Optional[Priority] = None


class NoteImportItem(NoteCreate):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NoteImportRequest(BaseModel):
    notes: List[NoteImportItem] = Field(default_factory=list, max_length=1000)


class NoteResponse(BaseModel):
    id: int
    title: str
    case_ref: Optional[str]
    content: str
    priority: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
