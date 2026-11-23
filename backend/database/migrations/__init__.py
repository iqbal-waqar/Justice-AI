from backend.database.db import Base

from backend.database.migrations.user import User
from backend.database.migrations.hearing import Hearing
from backend.database.migrations.case_note import CaseNote
from backend.database.migrations.chat_history import ChatHistory
from backend.database.migrations.user_document import UserDocument
from backend.database.migrations.chat_session import ChatSession, ChatMessage
from backend.database.migrations.firm import Firm, FirmInvitation, FirmMember
from backend.database.migrations.client import Client, Matter
from backend.database.migrations.vault import VaultDocument, VaultAuditLog
from backend.database.migrations.billing import BillingEntry
from backend.database.migrations.library import LibraryResource
from backend.database.migrations.portal import CaseShare, ClientLogin

__all__ = ["Base", "User", "Hearing", "CaseNote", "ChatHistory", "UserDocument", "ChatSession", "ChatMessage",
           "Firm", "FirmMember", "FirmInvitation", "Client", "Matter", "VaultDocument", "VaultAuditLog", "BillingEntry",
           "LibraryResource", "CaseShare", "ClientLogin"]
