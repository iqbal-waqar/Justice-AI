from typing import Any, Dict

from backend.services.qdrant import qdrant_service, COLLECTION_NAME
from backend.services.ingestion import ingestion_service


class IngestionInteractor:
    """Thin wrapper over the unified ingestion service (backend.services.ingestion)."""

    def ingest_jsonl_file(
        self,
        file_path: str,
        doc_type: str,
        batch_size: int = 64,
        clean: bool = False,
        skip_existing: bool = False,
        progress_callback=None,
        total_records: int = 0,
    ) -> Dict[str, Any]:
        return ingestion_service.ingest_file(
            file_path=file_path,
            doc_type=doc_type,
            batch_size=batch_size,
            clean=clean,
            skip_existing=skip_existing,
            progress_callback=progress_callback,
            total_records=total_records,
        )

    def get_collection_stats(self) -> Dict[str, Any]:
        client = qdrant_service.get_qdrant_client()
        try:
            info = client.get_collection(COLLECTION_NAME)
            return {
                "collection_exists": True,
                "collection_name": COLLECTION_NAME,
                "total_objects": info.points_count or 0,
            }
        except Exception:
            return {
                "collection_exists": False,
                "collection_name": COLLECTION_NAME,
                "total_objects": 0,
            }


def ingest_jsonl_file(
    file_path: str,
    doc_type: str,
    batch_size: int = 64,
    clean: bool = False,
    skip_existing: bool = False,
    progress_callback=None,
    total_records: int = 0,
) -> Dict[str, Any]:
    return ingestion_service.ingest_file(
        file_path=file_path,
        doc_type=doc_type,
        batch_size=batch_size,
        clean=clean,
        skip_existing=skip_existing,
        progress_callback=progress_callback,
        total_records=total_records,
    )
