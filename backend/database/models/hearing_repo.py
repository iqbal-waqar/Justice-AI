from sqlalchemy.orm import Session
from backend.database.migrations.hearing import Hearing

class HearingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user(self, user_id: int, skip: int = 0, limit: int = 100):
        return self.db.query(Hearing).filter(Hearing.user_id == user_id).offset(skip).limit(limit).all()

    def get_by_id_and_user(self, hearing_id: int, user_id: int):
        return self.db.query(Hearing).filter(Hearing.id == hearing_id, Hearing.user_id == user_id).first()

    def create(self, user_id: int, hearing_data: dict):
        hearing = Hearing(user_id=user_id, **hearing_data)
        self.db.add(hearing)
        self.db.commit()
        self.db.refresh(hearing)
        return hearing

    def update(self, hearing: Hearing, update_data: dict):
        for key, value in update_data.items():
            if value is not None:
                setattr(hearing, key, value)
        self.db.commit()
        self.db.refresh(hearing)
        return hearing

    def delete(self, hearing: Hearing):
        self.db.delete(hearing)
        self.db.commit()
