from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.database.models import ChatSessionRepository
from backend.schemas import MessageCreate, MessageResponse, SessionResponse, SessionUpdate


class ChatSessionInteractor:
    # ── serializers (explicit so datetimes become strings safely) ──
    def _to_message(self, m) -> MessageResponse:
        return MessageResponse(
            id=m.id,
            role=m.role,
            content=m.content,
            sources=m.sources,
            created_at=str(m.created_at) if m.created_at else None,
        )

    def _to_session(self, session, repo: ChatSessionRepository) -> SessionResponse:
        messages = repo.get_session_messages(session.id)
        last = messages[-1].content if messages else None
        return SessionResponse(
            id=session.id,
            title=session.title,
            case_reference=session.case_reference,
            created_at=str(session.created_at) if session.created_at else None,
            updated_at=str(session.updated_at) if session.updated_at else None,
            last_message=(last[:120] if last else None),
            message_count=len(messages),
        )

    def create_session(self, user_id: int, title: str, case_reference: str, db: Session) -> SessionResponse:
        repo = ChatSessionRepository(db)
        session = repo.create_session(user_id, title, case_reference)
        return self._to_session(session, repo)

    def get_sessions(self, user_id: int, db: Session) -> list[SessionResponse]:
        repo = ChatSessionRepository(db)
        sessions = repo.get_user_sessions(user_id)
        return [self._to_session(item, repo) for item in sessions]

    def get_session(self, session_id: int, user_id: int, db: Session) -> SessionResponse:
        repo = ChatSessionRepository(db)
        session = repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return self._to_session(session, repo)

    def get_session_history(self, session_id: int, user_id: int, db: Session) -> list[MessageResponse]:
        repo = ChatSessionRepository(db)
        session = repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return [self._to_message(m) for m in repo.get_session_messages(session_id)]

    def add_message(self, session_id: int, user_id: int, data: MessageCreate, db: Session) -> MessageResponse:
        repo = ChatSessionRepository(db)
        session = repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Auto-title the session from its first user message.
        if data.role == "user" and (not session.title or session.title == "New Chat"):
            if repo.count_messages(session_id) == 0:
                repo.update_session(session, {"title": data.content.strip()[:60] or "New Chat"})

        message = repo.add_message(session_id, data.role, data.content, data.sources)
        return self._to_message(message)

    def update_session(self, session_id: int, user_id: int, update: SessionUpdate, db: Session) -> SessionResponse:
        repo = ChatSessionRepository(db)
        session = repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        updated = repo.update_session(session, update.model_dump(exclude_unset=True))
        return self._to_session(updated, repo)

    def delete_session(self, session_id: int, user_id: int, db: Session):
        repo = ChatSessionRepository(db)
        session = repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        repo.delete_session(session)
        return {"message": "Session deleted"}


chat_session_interactor = ChatSessionInteractor()
