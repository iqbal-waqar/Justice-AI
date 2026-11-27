from decimal import Decimal
from typing import Dict, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from backend.database.migrations.billing import BillingEntry
from backend.database.migrations.client import Client, Matter
from backend.database.migrations.hearing import Hearing
from backend.database.migrations.user import User
from backend.database.migrations.vault import VaultDocument
from backend.interactors.firm_interactor import FirmContext


def client_balances(db: Session, firm_id: int, client_ids: Optional[Iterable[int]] = None) -> Dict[int, Decimal]:
    signed = case(
        (BillingEntry.entry_type == "payment", -BillingEntry.amount),
        (BillingEntry.entry_type == "expense", case((BillingEntry.billable.is_(True), BillingEntry.amount), else_=0)),
        else_=BillingEntry.amount,
    )
    q = (db.query(BillingEntry.client_id, func.coalesce(func.sum(signed), 0))
         .filter(BillingEntry.firm_id == firm_id, BillingEntry.status == "approved"))
    if client_ids is not None:
        q = q.filter(BillingEntry.client_id.in_(list(client_ids)))
    return {cid: Decimal(total) for cid, total in q.group_by(BillingEntry.client_id).all()}


class ClientInteractor:
    def get_client(self, ctx: FirmContext, client_id: int, db: Session) -> Client:
        c = db.query(Client).filter(Client.id == client_id, Client.firm_id == ctx.firm_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Client not found.")
        return c

    def get_matter(self, ctx: FirmContext, matter_id: int, db: Session) -> Matter:
        m = db.query(Matter).filter(Matter.id == matter_id, Matter.firm_id == ctx.firm_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Case not found.")
        return m

    def _doc_counts(self, db: Session, firm_id: int, column) -> Dict[int, int]:
        rows = (db.query(column, func.count(VaultDocument.id))
                .filter(VaultDocument.firm_id == firm_id, column.isnot(None)).group_by(column).all())
        return dict(rows)

    def _client_out(self, c: Client, balances, client_docs, matter_docs) -> dict:
        return {
            "id": c.id, "name": c.name, "phone": c.phone, "email": c.email, "cnic": c.cnic,
            "address": c.address, "notes": c.notes, "created_at": c.created_at,
            "document_count": client_docs.get(c.id, 0),
            "balance": balances.get(c.id, Decimal("0")),
            "matters": [self._matter_out(m, matter_docs) for m in sorted(c.matters, key=lambda m: m.created_at, reverse=True)],
        }

    COURT_FIELDS = ("district", "court_type", "judge", "category", "stage", "filed_on", "next_hearing",
                    "fir_number", "fir_year", "police_station", "source", "source_url", "assigned_to")

    def _matter_out(self, m: Matter, matter_docs, hearing_counts=None, names=None) -> dict:
        out = {"id": m.id, "client_id": m.client_id, "client_name": m.client.name if m.client else None,
               "title": m.title, "case_number": m.case_number, "court": m.court, "status": m.status,
               "description": m.description, "synced_at": m.synced_at, "created_at": m.created_at,
               "document_count": matter_docs.get(m.id, 0), "hearing_count": (hearing_counts or {}).get(m.id, 0),
               "assigned_to_name": (names or {}).get(m.assigned_to)}
        out.update({f: getattr(m, f) for f in self.COURT_FIELDS})
        return out

    def _hearing_counts(self, db: Session, firm_id: int) -> Dict[int, int]:
        rows = (db.query(Hearing.matter_id, func.count(Hearing.id)).join(Matter, Matter.id == Hearing.matter_id)
                .filter(Matter.firm_id == firm_id).group_by(Hearing.matter_id).all())
        return dict(rows)

    def _member_names(self, ctx: FirmContext, db: Session) -> Dict[int, str]:
        ids = [m.user_id for m in ctx.firm.members]
        return {u.id: u.full_name for u in db.query(User).filter(User.id.in_(ids)).all()} if ids else {}

    def list_matters(self, ctx: FirmContext, db: Session) -> list:
        matters = (db.query(Matter).filter(Matter.firm_id == ctx.firm_id)
                   .order_by(Matter.status.asc(), Matter.next_hearing.is_(None), Matter.next_hearing.asc(), Matter.created_at.desc()).all())
        docs = self._doc_counts(db, ctx.firm_id, VaultDocument.matter_id)
        counts, names = self._hearing_counts(db, ctx.firm_id), self._member_names(ctx, db)
        return [self._matter_out(m, docs, counts, names) for m in matters]

    def _file_proceedings(self, ctx: FirmContext, m: Matter, proceedings: list, db: Session) -> None:
        """Fetched proceeding history → case diary entries (past ones completed, future ones upcoming)."""
        existing = {h.hearing_date for h in db.query(Hearing).filter(Hearing.matter_id == m.id).all()}
        today = datetime.now(timezone.utc).date()
        for p in proceedings:
            if p["date"] in existing:
                continue
            note = " — ".join(x for x in (p.get("stage"), p.get("order")) if x) or None
            db.add(Hearing(user_id=ctx.user.id, matter_id=m.id, case_title=m.title, case_number=m.case_number,
                           court=m.court, hearing_date=p["date"], notes=note,
                           status="completed" if p["date"] < today else "upcoming"))
            existing.add(p["date"])
        if m.next_hearing and m.next_hearing not in existing and m.next_hearing >= today:
            db.add(Hearing(user_id=ctx.user.id, matter_id=m.id, case_title=m.title, case_number=m.case_number,
                           court=m.court, hearing_date=m.next_hearing, notes=m.stage, status="upcoming"))

    def list_clients(self, ctx: FirmContext, db: Session, search: Optional[str] = None) -> list:
        q = db.query(Client).filter(Client.firm_id == ctx.firm_id)
        if search:
            like = f"%{search.strip()}%"
            q = q.filter(or_(Client.name.ilike(like), Client.phone.ilike(like), Client.email.ilike(like),
                             Client.cnic.ilike(like)))
        clients = q.order_by(Client.name.asc()).all()
        balances = client_balances(db, ctx.firm_id)
        client_docs = self._doc_counts(db, ctx.firm_id, VaultDocument.client_id)
        matter_docs = self._doc_counts(db, ctx.firm_id, VaultDocument.matter_id)
        return [self._client_out(c, balances, client_docs, matter_docs) for c in clients]

    def client_detail(self, ctx: FirmContext, client_id: int, db: Session) -> dict:
        c = self.get_client(ctx, client_id, db)
        return self._client_out(c, client_balances(db, ctx.firm_id, [c.id]),
                                self._doc_counts(db, ctx.firm_id, VaultDocument.client_id),
                                self._doc_counts(db, ctx.firm_id, VaultDocument.matter_id))

    def create_client(self, ctx: FirmContext, data: dict, db: Session) -> dict:
        c = Client(firm_id=ctx.firm_id, created_by=ctx.user.id, **data)
        db.add(c)
        db.commit()
        db.refresh(c)
        return self.client_detail(ctx, c.id, db)

    def update_client(self, ctx: FirmContext, client_id: int, data: dict, db: Session) -> dict:
        c = self.get_client(ctx, client_id, db)
        for k, v in data.items():
            if k == "name" and not v:
                continue
            setattr(c, k, v)
        db.commit()
        return self.client_detail(ctx, client_id, db)

    def delete_client(self, ctx: FirmContext, client_id: int, db: Session) -> dict:
        ctx.require(ctx.can_approve, "Only an owner or partner can delete clients.")
        c = self.get_client(ctx, client_id, db)
        if db.query(BillingEntry).filter(BillingEntry.client_id == c.id).count():
            raise HTTPException(status_code=409, detail="This client has billing records, so it cannot be deleted.")
        if db.query(VaultDocument).filter(VaultDocument.client_id == c.id).count():
            raise HTTPException(status_code=409, detail="This client has documents in the vault. Move or delete them first.")
        db.delete(c)
        db.commit()
        return {"detail": "Client deleted."}

    def _check_assignee(self, ctx: FirmContext, user_id) -> None:
        if user_id is not None and user_id not in {mb.user_id for mb in ctx.firm.members}:
            raise HTTPException(status_code=400, detail="Cases can only be assigned to members of your firm.")

    def create_matter(self, ctx: FirmContext, data: dict, db: Session) -> dict:
        proceedings = data.pop("proceedings", None) or []
        new_client = data.pop("new_client", None)
        if new_client:
            c = Client(firm_id=ctx.firm_id, created_by=ctx.user.id, **new_client)
            db.add(c)
            db.flush()
            data["client_id"] = c.id
        elif data.get("client_id"):
            self.get_client(ctx, data["client_id"], db)
        else:
            raise HTTPException(status_code=400, detail="Choose a client for the case or add a new one.")
        self._check_assignee(ctx, data.get("assigned_to"))
        if data.get("source") and data["source"] != "manual":
            data["synced_at"] = datetime.now(timezone.utc)
        m = Matter(firm_id=ctx.firm_id, created_by=ctx.user.id, **data)
        db.add(m)
        db.flush()
        if proceedings:
            self._file_proceedings(ctx, m, proceedings, db)
        db.commit()
        db.refresh(m)
        return self._matter_out(m, {}, self._hearing_counts(db, ctx.firm_id), self._member_names(ctx, db))

    def update_matter(self, ctx: FirmContext, matter_id: int, data: dict, db: Session) -> dict:
        m = self.get_matter(ctx, matter_id, db)
        proceedings = data.pop("proceedings", None)
        self._check_assignee(ctx, data.get("assigned_to"))
        if data.get("source") and data["source"] != "manual" and data["source"] != m.source:
            data["synced_at"] = datetime.now(timezone.utc)
        for k, v in data.items():
            if k in ("title", "status") and not v:
                continue
            setattr(m, k, v)
        if proceedings:
            self._file_proceedings(ctx, m, proceedings, db)
        db.commit()
        db.refresh(m)
        return self._matter_out(m, self._doc_counts(db, ctx.firm_id, VaultDocument.matter_id),
                                self._hearing_counts(db, ctx.firm_id), self._member_names(ctx, db))

    def delete_matter(self, ctx: FirmContext, matter_id: int, db: Session) -> dict:
        ctx.require(ctx.can_approve, "Only an owner or partner can delete cases.")
        m = self.get_matter(ctx, matter_id, db)
        if db.query(BillingEntry).filter(BillingEntry.matter_id == m.id).count():
            raise HTTPException(status_code=409, detail="This case has billing records. Close it instead of deleting.")
        if db.query(VaultDocument).filter(VaultDocument.matter_id == m.id).count():
            raise HTTPException(status_code=409, detail="This case has documents in the vault. Move or delete them first.")
        db.delete(m)
        db.commit()
        return {"detail": "Case deleted."}


client_interactor = ClientInteractor()
