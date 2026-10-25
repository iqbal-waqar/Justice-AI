from pydantic import BaseModel, Field
from typing import Optional, List

class ChatRequest(BaseModel):
    query: str = Field(..., description="User's legal query", min_length=1)
    conversation_history: Optional[List[dict]] = Field(
        default=[], description="Previous conversation messages"
    )
    filters: Optional[dict] = Field(
        default=None, description="Optional filters: court, doc_type, year"
    )

class SourceDocument(BaseModel):
    content: Optional[str] = None
    doc_type: Optional[str] = None
    title: Optional[str] = None
    judge_name: Optional[str] = None
    court: Optional[str] = None
    year: Optional[str] = None
    score: Optional[float] = None
    pdf_url: Optional[str] = None
    image_url: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceDocument]
    query: str
    agent_trace: Optional[List[str]] = Field(
        default=[], description="Step-by-step agent reasoning trace"
    )

# ── Chat Session Schemas ──
class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"
    case_reference: Optional[str] = None

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    case_reference: Optional[str] = None

class SessionResponse(BaseModel):
    id: int
    title: str
    case_reference: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    last_message: Optional[str] = None
    message_count: int = 0

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    role: str = Field(..., pattern="^(user|ai)$")
    content: str = Field(..., min_length=1)
    sources: Optional[list] = None

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[list] = None
    created_at: Optional[str]

    class Config:
        from_attributes = True
