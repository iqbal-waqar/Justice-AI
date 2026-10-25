from pydantic import BaseModel, Field
from backend.schemas.documents import DocumentType

class IngestRequest(BaseModel):
    file_path: str = Field(..., description="Path to JSONL file")
    doc_type: DocumentType = Field(..., description="Type of documents in the file")
    batch_size: int = Field(default=100, ge=10, le=500)

class IngestResponse(BaseModel):
    message: str
    documents_processed: int
    doc_type: str
