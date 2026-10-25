from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    qdrant: str
    llm: str
