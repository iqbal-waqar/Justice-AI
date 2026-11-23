from decimal import Decimal
from typing import Dict, Iterable, Optional

from fastapi import HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from backend.database.migrations.billing import BillingEntry
from backend.database.migrations.client import Client, Matter
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

    def _matter_out(self, m: Matter, matter_docs) -> dict:
        return {"id": m.id, "client_id": m.client_id, "title": m.title, "case_number": m.case_number,
                "court": m.court, "status": m.status, "description": m.description,
                "created_at": m.created_at, "document_count": matter_docs.get(m.id, 0)}

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

    def create_matter(self, ctx: FirmContext, data: dict, db: Session) -> dict:
        self.get_client(ctx, data["client_id"], db)
        m = Matter(firm_id=ctx.firm_id, created_by=ctx.user.id, **data)
        db.add(m)
        db.commit()
        db.refresh(m)
        return self._matter_out(m, {})

    def update_matter(self, ctx: FirmContext, matter_id: int, data: dict, db: Session) -> dict:
        m = self.get_matter(ctx, matter_id, db)
        for k, v in data.items():
            if k in ("title", "status") and not v:
                continue
            setattr(m, k, v)
        db.commit()
        db.refresh(m)
        return self._matter_out(m, self._doc_counts(db, ctx.firm_id, VaultDocument.matter_id))

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
