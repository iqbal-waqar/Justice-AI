from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.hearing_interactor import HearingInteractor
from backend.schemas import HearingCreate, HearingUpdate, HearingResponse

router = APIRouter()
interactor = HearingInteractor()

@router.post("/hearings", response_model=HearingResponse)
def create_hearing(
    hearing: HearingCreate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.create_hearing(current_user.id, hearing, db)

@router.get("/hearings", response_model=List[HearingResponse])
def get_hearings(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.list_hearings(current_user.id, skip, limit, db)

@router.put("/hearings/{hearing_id}", response_model=HearingResponse)
def update_hearing(
    hearing_id: int,
    hearing_data: HearingUpdate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.update_hearing(hearing_id, current_user.id, hearing_data, db)

@router.delete("/hearings/{hearing_id}")
def delete_hearing(
    hearing_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.delete_hearing(hearing_id, current_user.id, db)
