from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class DocumentType(str, Enum):
    # ── Court Cases ──────────────────────────────────────────────────────────
    LHC_CASE = "lhc_case"
    LHC_DISTRICT = "lhc_district"
    SC_CASE = "sc_case"
    ISB_CASE = "isb_case"
    # ── Judge Profiles ───────────────────────────────────────────────────────
    LHC_JUDGE = "lhc_judge"
    LHC_JUDGE_NEW = "lhc_judge_new"
    SC_JUDGE = "sc_judge"
    ISB_JUDGE = "isb_judge"
    # ── Statutes & Laws ──────────────────────────────────────────────────────
    FEDERAL_LAW = "federal_law"
    PUNJAB_LAW = "punjab_law"

class DocumentResponse(BaseModel):
    id: int
    original_name: str
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    qdrant_doc_id: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class DocumentChatRequest(BaseModel):
    query: str = Field(..., min_length=1)

class DocumentChatResponse(BaseModel):
    answer: str
    chunks_used: int
    document_name: str
