from sqlalchemy.orm import Session
from backend.database.migrations.case_note import CaseNote


class NoteRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user(self, user_id: int):
        return (
            self.db.query(CaseNote)
            .filter(CaseNote.user_id == user_id)
            .order_by(CaseNote.updated_at.desc())
            .all()
        )

    def get_by_id_and_user(self, note_id: int, user_id: int):
        return self.db.query(CaseNote).filter(CaseNote.id == note_id, CaseNote.user_id == user_id).first()

    def create(self, user_id: int, data: dict):
        note = CaseNote(user_id=user_id, **data)
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def create_many(self, user_id: int, items: list):
        notes = [CaseNote(user_id=user_id, **data) for data in items]
        self.db.add_all(notes)
        self.db.commit()
        return notes

    def update(self, note: CaseNote, data: dict):
        for key, value in data.items():
            setattr(note, key, value)
        self.db.commit()
        self.db.refresh(note)
        return note

    def delete(self, note: CaseNote):
        self.db.delete(note)
        self.db.commit()
