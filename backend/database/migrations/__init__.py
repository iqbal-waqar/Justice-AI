"""
Justice AI — SQLAlchemy Models Package.
All table definitions live here. Import Base from db.py.
"""

from backend.database.db import Base

# Import all models so Alembic can detect them
from backend.database.migrations.user import User
from backend.database.migrations.hearing import Hearing
from backend.database.migrations.case_note import CaseNote
from backend.database.migrations.chat_history import ChatHistory
from backend.database.migrations.user_document import UserDocument
from backend.database.migrations.chat_session import ChatSession, ChatMessage

__all__ = ["Base", "User", "Hearing", "CaseNote", "ChatHistory", "UserDocument", "ChatSession", "ChatMessage"]
