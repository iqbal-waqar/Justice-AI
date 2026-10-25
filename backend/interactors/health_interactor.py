import os
from backend.schemas import HealthResponse
from backend.services.qdrant import qdrant_service
from backend.services.cache import cache_service

class HealthInteractor:
    def check_system_health(self) -> HealthResponse:
        qdrant_status = "unknown"
        try:
            client = qdrant_service.get_qdrant_client()
            if client.is_ready():
                qdrant_status = "connected"
            else:
                qdrant_status = "not_ready"
        except Exception as e:
            qdrant_status = f"error: {str(e)[:80]}"

        groq_key = os.getenv("GROQ_API_KEY", "")
        llm_status = "configured" if groq_key else "missing_api_key"

        overall = "healthy" if qdrant_status == "connected" and llm_status == "configured" else "degraded"

        return HealthResponse(
            status=overall,
            qdrant=qdrant_status,
            llm=llm_status,
        )

    def get_cache_status(self) -> dict:
        return cache_service.get_cache_stats()

    def clear_all_caches(self) -> None:
        cache_service.clear_cache()
