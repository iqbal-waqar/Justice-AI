from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.note_interactor import NoteInteractor
from backend.schemas import NoteCreate, NoteImportRequest, NoteResponse, NoteUpdate

router = APIRouter()
interactor = NoteInteractor()


@router.get("/notes", response_model=List[NoteResponse])
def list_notes(
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.list_notes(current_user.id, db)


@router.post("/notes", response_model=NoteResponse)
def create_note(
    note: NoteCreate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.create_note(current_user.id, note, db)


@router.post("/notes/import", response_model=List[NoteResponse])
def import_notes(
    req: NoteImportRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.import_notes(current_user.id, req, db)


@router.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    note: NoteUpdate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.update_note(note_id, current_user.id, note, db)


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return interactor.delete_note(note_id, current_user.id, db)
