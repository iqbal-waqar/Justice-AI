from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class LawOut(BaseModel):
    id: str
    title: str
    jurisdiction: str
    category: str
    year: Optional[str] = None
    law_no: Optional[str] = None
    pdf_url: Optional[str] = None
    source_url: Optional[str] = None


class LawSearchOut(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[LawOut]
    jurisdictions: List[str]
    categories: List[str]
    library_total: int


class LibraryResourceOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: str
    tags: List[str]
    language: Optional[str] = None
    original_filename: str
    size_bytes: int
    page_count: Optional[int] = None
    is_system: bool
    can_delete: bool
    uploaded_by_name: Optional[str] = None
    created_at: datetime
