from fastapi import APIRouter
from backend.schemas import HealthResponse
from backend.interactors.health_interactor import HealthInteractor

router = APIRouter()
interactor = HealthInteractor()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health endpoint — delegates entirely to the health interactor."""
    return interactor.check_system_health()

@router.get("/cache/stats")
async def cache_stats():
    """Get cache statistics."""
    return interactor.get_cache_status()

@router.post("/cache/clear")
async def cache_clear():
    """Clear all caches."""
    interactor.clear_all_caches()
    return {"message": "All caches cleared"}
