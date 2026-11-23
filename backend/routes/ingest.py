from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.ingestion_interactor import IngestionInteractor
from backend.schemas import IngestRequest, IngestResponse
from backend.services.cache import cache_service

router = APIRouter()
interactor = IngestionInteractor()

DATA_DIR = (Path(__file__).resolve().parents[2] / "data").resolve()


def _safe_data_path(raw: str) -> Path:
    rel = raw.strip().lstrip("/")
    if rel.startswith("data/"):
        rel = rel[len("data/"):]
    path = (DATA_DIR / rel).resolve()
    if not path.is_relative_to(DATA_DIR):
        raise HTTPException(status_code=400, detail="file_path must be inside the data directory")
    if path.suffix.lower() != ".jsonl":
        raise HTTPException(status_code=400, detail="Only .jsonl files can be ingested")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found in the data directory")
    return path


@router.post("/ingest", response_model=IngestResponse)
def ingest_file(request: IngestRequest, admin: User = Depends(auth_interactor.require_admin)):
    path = _safe_data_path(request.file_path)
    try:
        result = interactor.ingest_jsonl_file(
            file_path=str(path),
            doc_type=request.doc_type.value,
            batch_size=request.batch_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    cache_service.clear_cache()
    return IngestResponse(
        message=result["message"],
        documents_processed=result["documents_processed"],
        doc_type=result["doc_type"],
    )


@router.get("/ingest/stats")
def ingestion_stats(admin: User = Depends(auth_interactor.require_admin)):
    try:
        return interactor.get_collection_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats error: {str(e)}")
