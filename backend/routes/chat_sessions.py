from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
from backend.interactors.chat_session_interactor import ChatSessionInteractor
from backend.schemas import SessionResponse, SessionCreate, SessionUpdate, MessageResponse, MessageCreate

router = APIRouter()
interactor = ChatSessionInteractor()

@router.post("/chat/sessions", response_model=SessionResponse)
def create_session(
    data: SessionCreate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.create_session(current_user.id, data.title, data.case_reference, db)

@router.get("/chat/sessions", response_model=List[SessionResponse])
def get_sessions(
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.get_sessions(current_user.id, db)

@router.get("/chat/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.get_session(session_id, current_user.id, db)

# ── Messages ──────────────────────────────────────────────────────────────
@router.get("/chat/sessions/{session_id}/messages", response_model=List[MessageResponse])
def get_session_messages(
    session_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.get_session_history(session_id, current_user.id, db)

@router.post("/chat/sessions/{session_id}/messages", response_model=MessageResponse)
def add_session_message(
    session_id: int,
    data: MessageCreate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.add_message(session_id, current_user.id, data, db)

# Backward-compatible alias for the older /history path.
@router.get("/chat/sessions/{session_id}/history", response_model=List[MessageResponse])
def get_session_history(
    session_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.get_session_history(session_id, current_user.id, db)

@router.put("/chat/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    data: SessionUpdate,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.update_session(session_id, current_user.id, data, db)

@router.delete("/chat/sessions/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db)
):
    return interactor.delete_session(session_id, current_user.id, db)
