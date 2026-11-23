from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.database.models import NoteRepository
from backend.schemas import NoteCreate, NoteImportRequest, NoteResponse, NoteUpdate


class NoteInteractor:
    def list_notes(self, user_id: int, db: Session) -> list[NoteResponse]:
        return [NoteResponse.model_validate(n) for n in NoteRepository(db).get_by_user(user_id)]

    def create_note(self, user_id: int, data: NoteCreate, db: Session) -> NoteResponse:
        return NoteResponse.model_validate(NoteRepository(db).create(user_id, data.model_dump()))

    def update_note(self, note_id: int, user_id: int, data: NoteUpdate, db: Session) -> NoteResponse:
        repo = NoteRepository(db)
        note = repo.get_by_id_and_user(note_id, user_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        changes = data.model_dump(exclude_unset=True)
        changes = {k: v for k, v in changes.items() if v is not None or k == "case_ref"}
        return NoteResponse.model_validate(repo.update(note, changes))

    def delete_note(self, note_id: int, user_id: int, db: Session):
        repo = NoteRepository(db)
        note = repo.get_by_id_and_user(note_id, user_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        repo.delete(note)
        return {"detail": "Note deleted successfully"}

    def import_notes(self, user_id: int, req: NoteImportRequest, db: Session) -> list[NoteResponse]:
        items = []
        for n in req.notes:
            row = n.model_dump(exclude_none=True)
            items.append(row)
        if items:
            NoteRepository(db).create_many(user_id, items)
        return self.list_notes(user_id, db)
