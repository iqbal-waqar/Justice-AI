from fastapi import APIRouter, HTTPException
from backend.schemas import IngestRequest, IngestResponse
from backend.interactors.ingestion_interactor import IngestionInteractor

router = APIRouter()
interactor = IngestionInteractor()

@router.post("/ingest", response_model=IngestResponse)
async def ingest_file(request: IngestRequest):
    try:
        result = interactor.ingest_jsonl_file(
            file_path=request.file_path,
            doc_type=request.doc_type.value,
            batch_size=request.batch_size,
        )
        return IngestResponse(
            message=result["message"],
            documents_processed=result["documents_processed"],
            doc_type=result["doc_type"],
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@router.get("/ingest/stats")
async def ingestion_stats():
    try:
        return interactor.get_collection_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats error: {str(e)}")
