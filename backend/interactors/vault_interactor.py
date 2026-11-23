import hashlib
import uuid
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.database.migrations.client import Client, Matter
from backend.database.migrations.user import User
from backend.database.migrations.vault import VAULT_CATEGORIES, VaultAuditLog, VaultDocument
from backend.interactors.client_interactor import client_interactor
from backend.interactors.firm_interactor import FirmContext
from backend.services.storage import StorageError, vault_storage

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

_ZIP = b"PK\x03\x04"
_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
ALLOWED_TYPES = {
    "pdf": ("application/pdf", lambda b: b.startswith(b"%PDF")),
    "png": ("image/png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    "jpg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    "jpeg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", lambda b: b.startswith(_ZIP)),
    "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", lambda b: b.startswith(_ZIP)),
    "doc": ("application/msword", lambda b: b.startswith(_OLE)),
    "xls": ("application/vnd.ms-excel", lambda b: b.startswith(_OLE)),
    "txt": ("text/plain", lambda b: b"\x00" not in b[:4096]),
}
INLINE_TYPES = {"application/pdf", "image/png", "image/jpeg", "text/plain"}


class VaultInteractor:
    def _audit(self, db: Session, ctx: FirmContext, action: str, doc: Optional[VaultDocument], ip: Optional[str]):
        db.add(VaultAuditLog(firm_id=ctx.firm_id, document_id=doc.id if doc else None,
                             document_title=doc.title if doc else None, user_id=ctx.user.id,
                             action=action, ip_address=ip))

    def _get(self, ctx: FirmContext, doc_id: int, db: Session) -> VaultDocument:
        doc = db.query(VaultDocument).filter(VaultDocument.id == doc_id, VaultDocument.firm_id == ctx.firm_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")
        return doc

    def _link(self, ctx: FirmContext, db: Session, client_id: Optional[int], matter_id: Optional[int]) -> Tuple[Optional[int], Optional[int]]:
        if matter_id:
            m = client_interactor.get_matter(ctx, matter_id, db)
            if client_id and client_id != m.client_id:
                raise HTTPException(status_code=400, detail="That case belongs to a different client.")
            return m.client_id, m.id
        if client_id:
            client_interactor.get_client(ctx, client_id, db)
        return client_id, None

    def _out(self, db: Session, docs) -> list:
        client_ids = {d.client_id for d in docs if d.client_id}
        matter_ids = {d.matter_id for d in docs if d.matter_id}
        user_ids = {d.uploaded_by for d in docs if d.uploaded_by}
        clients = dict(db.query(Client.id, Client.name).filter(Client.id.in_(client_ids)).all()) if client_ids else {}
        matters = dict(db.query(Matter.id, Matter.title).filter(Matter.id.in_(matter_ids)).all()) if matter_ids else {}
        users = dict(db.query(User.id, User.full_name).filter(User.id.in_(user_ids)).all()) if user_ids else {}
        return [{
            "id": d.id, "title": d.title, "category": d.category, "description": d.description,
            "original_filename": d.original_filename, "content_type": d.content_type,
            "size_bytes": d.size_bytes, "sha256": d.sha256,
            "client_id": d.client_id, "client_name": clients.get(d.client_id),
            "matter_id": d.matter_id, "matter_title": matters.get(d.matter_id),
            "uploaded_by": d.uploaded_by, "uploaded_by_name": users.get(d.uploaded_by),
            "created_at": d.created_at, "updated_at": d.updated_at,
        } for d in docs]

    def upload(self, ctx: FirmContext, db: Session, *, data: bytes, filename: str, title: Optional[str],
               category: str, description: Optional[str], client_id: Optional[int], matter_id: Optional[int],
               ip: Optional[str]) -> dict:
        if not data:
            raise HTTPException(status_code=400, detail="The file is empty.")
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File is larger than 25 MB.")
        ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
        if ext not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Allowed file types: PDF, Word, Excel, JPG, PNG, TXT.")
        content_type, looks_right = ALLOWED_TYPES[ext]
        if not looks_right(data[:8192]):
            raise HTTPException(status_code=400, detail=f"The file's contents do not match a .{ext} file.")
        if category not in VAULT_CATEGORIES:
            category = "other"
        client_id, matter_id = self._link(ctx, db, client_id, matter_id)

        key = f"firms/{ctx.firm_id}/documents/{uuid.uuid4().hex}"
        try:
            vault_storage.save(key, data)
        except StorageError as exc:
            raise HTTPException(status_code=502, detail=str(exc))

        doc = VaultDocument(
            firm_id=ctx.firm_id, client_id=client_id, matter_id=matter_id,
            title=(title or "").strip() or filename.rsplit(".", 1)[0][:300],
            category=category, description=(description or "").strip() or None,
            original_filename=filename[:300], content_type=content_type, size_bytes=len(data),
            sha256=hashlib.sha256(data).hexdigest(), storage_key=key, uploaded_by=ctx.user.id,
        )
        db.add(doc)
        try:
            db.flush()
            self._audit(db, ctx, "upload", doc, ip)
            db.commit()
        except Exception:
            db.rollback()
            vault_storage.remove(key)
            raise
        db.refresh(doc)
        return self._out(db, [doc])[0]

    def list_documents(self, ctx: FirmContext, db: Session, *, client_id=None, matter_id=None,
                       category=None, search=None) -> list:
        q = db.query(VaultDocument).filter(VaultDocument.firm_id == ctx.firm_id)
        if client_id:
            q = q.filter(VaultDocument.client_id == client_id)
        if matter_id:
            q = q.filter(VaultDocument.matter_id == matter_id)
        if category:
            q = q.filter(VaultDocument.category == category)
        if search:
            like = f"%{search.strip()}%"
            q = q.filter(or_(VaultDocument.title.ilike(like), VaultDocument.original_filename.ilike(like),
                             VaultDocument.description.ilike(like)))
        return self._out(db, q.order_by(VaultDocument.created_at.desc()).limit(500).all())

    def read_file(self, ctx: FirmContext, doc_id: int, db: Session, *, inline: bool, ip: Optional[str]):
        doc = self._get(ctx, doc_id, db)
        try:
            data = vault_storage.load(doc.storage_key)
        except StorageError as exc:
            raise HTTPException(status_code=502, detail=str(exc))
        if hashlib.sha256(data).hexdigest() != doc.sha256:
            raise HTTPException(status_code=500, detail="The stored file failed its integrity check.")
        self._audit(db, ctx, "view" if inline else "download", doc, ip)
        db.commit()
        return doc, data, inline and doc.content_type in INLINE_TYPES

    def update(self, ctx: FirmContext, doc_id: int, changes: dict, db: Session, ip: Optional[str]) -> dict:
        doc = self._get(ctx, doc_id, db)
        if "client_id" in changes or "matter_id" in changes:
            doc.client_id, doc.matter_id = self._link(ctx, db, changes.get("client_id", doc.client_id),
                                                      changes.get("matter_id", doc.matter_id))
        for k in ("title", "category", "description"):
            if k in changes and (changes[k] or k == "description"):
                setattr(doc, k, changes[k])
        self._audit(db, ctx, "update", doc, ip)
        db.commit()
        db.refresh(doc)
        return self._out(db, [doc])[0]

    def delete(self, ctx: FirmContext, doc_id: int, db: Session, ip: Optional[str]) -> dict:
        doc = self._get(ctx, doc_id, db)
        ctx.require(ctx.can_approve or doc.uploaded_by == ctx.user.id,
                    "Only the uploader, a partner or the owner can delete this document.")
        key = doc.storage_key
        self._audit(db, ctx, "delete", doc, ip)
        db.delete(doc)
        db.commit()
        try:
            vault_storage.remove(key)
        except StorageError:
            pass
        return {"detail": "Document deleted."}

    def audit_log(self, ctx: FirmContext, db: Session, document_id: Optional[int] = None, limit: int = 200) -> list:
        ctx.require(ctx.can_approve, "Only an owner or partner can view the vault activity log.")
        q = db.query(VaultAuditLog).filter(VaultAuditLog.firm_id == ctx.firm_id)
        if document_id:
            q = q.filter(VaultAuditLog.document_id == document_id)
        rows = q.order_by(VaultAuditLog.created_at.desc()).limit(min(limit, 1000)).all()
        users = dict(db.query(User.id, User.full_name).filter(User.id.in_({r.user_id for r in rows if r.user_id})).all())
        return [{"id": r.id, "document_id": r.document_id, "document_title": r.document_title,
                 "user_name": users.get(r.user_id), "action": r.action, "ip_address": r.ip_address,
                 "created_at": r.created_at} for r in rows]

    def stats(self, ctx: FirmContext, db: Session) -> dict:
        count, total = db.query(func.count(VaultDocument.id), func.coalesce(func.sum(VaultDocument.size_bytes), 0)) \
            .filter(VaultDocument.firm_id == ctx.firm_id).one()
        try:
            backend = vault_storage.backend.name
        except StorageError:
            backend = "not configured"
        return {"document_count": count, "total_bytes": int(total), "storage_backend": backend, "encrypted": True}


vault_interactor = VaultInteractor()
