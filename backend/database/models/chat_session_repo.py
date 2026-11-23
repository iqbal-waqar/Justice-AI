from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from backend.database.migrations.chat_session import ChatSession, ChatMessage


class ChatSessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(self, user_id: int, title: str, case_reference: str = None):
        session = ChatSession(user_id=user_id, title=title or "New Chat", case_reference=case_reference)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_user_sessions(self, user_id: int):
        return (
            self.db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .all()
        )

    def get_session_by_id_and_user(self, session_id: int, user_id: int):
        return (
            self.db.query(ChatSession)
            .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
            .first()
        )

    def get_session_messages(self, session_id: int):
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
            .all()
        )

    def count_messages(self, session_id: int) -> int:
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .count()
        )

    def add_message(self, session_id: int, role: str, content: str, sources=None):
        message = ChatMessage(session_id=session_id, role=role, content=content, sources=sources)
        self.db.add(message)
        session = self.db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if session is not None:
            session.updated_at = func.now()
        self.db.commit()
        self.db.refresh(message)
        return message

    def update_session(self, session: ChatSession, update_data: dict):
        for key, value in update_data.items():
            if value is not None:
                setattr(session, key, value)
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete_session(self, session: ChatSession):
        self.db.delete(session)
        self.db.commit()
