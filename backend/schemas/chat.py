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
    language: str = Field(
        default="auto", pattern="^(auto|en|ur)$",
        description="Answer language: 'ur' Urdu, 'en' English, 'auto' = Urdu when the question is in Urdu script",
    )

    def cache_filters(self) -> dict:
        return {**(self.filters or {}), "_lang": self.language}

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
