from fastapi import APIRouter, Depends

from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.health_interactor import HealthInteractor
from backend.schemas import HealthResponse

router = APIRouter()
interactor = HealthInteractor()


@router.get("/health", response_model=HealthResponse)
def health_check():
    return interactor.check_system_health()


@router.get("/cache/stats")
def cache_stats(admin: User = Depends(auth_interactor.require_admin)):
    return interactor.get_cache_status()


@router.post("/cache/clear")
def cache_clear(admin: User = Depends(auth_interactor.require_admin)):
    interactor.clear_all_caches()
    return {"message": "All caches cleared"}
