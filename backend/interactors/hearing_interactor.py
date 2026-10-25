from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.database.models import HearingRepository
from backend.schemas import HearingCreate, HearingResponse, HearingUpdate


class HearingInteractor:
    def create_hearing(self, user_id: int, data: HearingCreate, db: Session) -> HearingResponse:
        repo = HearingRepository(db)
        hearing = repo.create(user_id, data.model_dump())
        return HearingResponse.model_validate(hearing)

    def list_hearings(self, user_id: int, skip: int, limit: int, db: Session) -> list[HearingResponse]:
        repo = HearingRepository(db)
        hearings = repo.get_by_user(user_id, skip=skip, limit=limit)
        return [HearingResponse.model_validate(item) for item in hearings]

    def update_hearing(self, hearing_id: int, user_id: int, data: HearingUpdate, db: Session) -> HearingResponse:
        repo = HearingRepository(db)
        hearing = repo.get_by_id_and_user(hearing_id, user_id)
        if not hearing:
            raise HTTPException(status_code=404, detail="Hearing not found")
        updated = repo.update(hearing, data.model_dump(exclude_unset=True))
        return HearingResponse.model_validate(updated)

    def delete_hearing(self, hearing_id: int, user_id: int, db: Session):
        repo = HearingRepository(db)
        hearing = repo.get_by_id_and_user(hearing_id, user_id)
        if not hearing:
            raise HTTPException(status_code=404, detail="Hearing not found")
        repo.delete(hearing)
        return {"detail": "Hearing deleted successfully"}
