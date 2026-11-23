from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database.migrations.billing import BillingEntry
from backend.database.migrations.client import Client, Matter
from backend.database.migrations.user import User
from backend.interactors.client_interactor import client_balances, client_interactor
from backend.interactors.firm_interactor import FirmContext

ZERO = Decimal("0.00")


def _charge(e: BillingEntry) -> Decimal:
    if e.entry_type == "payment":
        return -Decimal(e.amount)
    if e.entry_type == "expense" and not e.billable:
        return ZERO
    return Decimal(e.amount)


class BillingInteractor:
    def _get(self, ctx: FirmContext, entry_id: int, db: Session) -> BillingEntry:
        e = db.query(BillingEntry).filter(BillingEntry.id == entry_id, BillingEntry.firm_id == ctx.firm_id).first()
        if not e:
            raise HTTPException(status_code=404, detail="Billing entry not found.")
        return e

    def _may_review(self, ctx: FirmContext, e: BillingEntry) -> bool:
        return ctx.can_approve and (e.created_by != ctx.user.id or ctx.firm.allow_self_approval)

    def _may_edit(self, ctx: FirmContext, e: BillingEntry) -> bool:
        return e.status == "pending" and (e.created_by == ctx.user.id or ctx.can_approve)

    def _out(self, ctx: FirmContext, db: Session, entries) -> list:
        cids = {e.client_id for e in entries}
        mids = {e.matter_id for e in entries if e.matter_id}
        uids = {u for e in entries for u in (e.created_by, e.reviewed_by) if u}
        clients = dict(db.query(Client.id, Client.name).filter(Client.id.in_(cids)).all()) if cids else {}
        matters = dict(db.query(Matter.id, Matter.title).filter(Matter.id.in_(mids)).all()) if mids else {}
        users = dict(db.query(User.id, User.full_name).filter(User.id.in_(uids)).all()) if uids else {}
        return [{
            "id": e.id, "client_id": e.client_id, "client_name": clients.get(e.client_id),
            "matter_id": e.matter_id, "matter_title": matters.get(e.matter_id),
            "entry_type": e.entry_type, "amount": Decimal(e.amount), "entry_date": e.entry_date,
            "description": e.description, "reference": e.reference, "payment_method": e.payment_method,
            "billable": e.billable, "status": e.status,
            "created_by": e.created_by, "created_by_name": users.get(e.created_by),
            "reviewed_by": e.reviewed_by, "reviewed_by_name": users.get(e.reviewed_by),
            "reviewed_at": e.reviewed_at, "review_note": e.review_note, "self_approved": e.self_approved,
            "created_at": e.created_at,
            "can_review": e.status == "pending" and self._may_review(ctx, e),
            "can_edit": self._may_edit(ctx, e),
        } for e in entries]

    def _normalise(self, data: dict, entry_type: str) -> dict:
        if entry_type != "payment":
            data["payment_method"] = None
        if entry_type != "expense":
            data["billable"] = True
        return data

    def list_entries(self, ctx: FirmContext, db: Session, *, client_id=None, matter_id=None, entry_type=None,
                     status=None, date_from=None, date_to=None, awaiting_me: bool = False) -> list:
        q = db.query(BillingEntry).filter(BillingEntry.firm_id == ctx.firm_id)
        if client_id:
            q = q.filter(BillingEntry.client_id == client_id)
        if matter_id:
            q = q.filter(BillingEntry.matter_id == matter_id)
        if entry_type:
            q = q.filter(BillingEntry.entry_type == entry_type)
        if status:
            q = q.filter(BillingEntry.status == status)
        if date_from:
            q = q.filter(BillingEntry.entry_date >= date_from)
        if date_to:
            q = q.filter(BillingEntry.entry_date <= date_to)
        entries = q.order_by(BillingEntry.entry_date.desc(), BillingEntry.id.desc()).limit(1000).all()
        out = self._out(ctx, db, entries)
        return [e for e in out if e["can_review"]] if awaiting_me else out

    def summary(self, ctx: FirmContext, db: Session) -> dict:
        approved = db.query(BillingEntry).filter(BillingEntry.firm_id == ctx.firm_id, BillingEntry.status == "approved")
        totals = dict(approved.with_entities(BillingEntry.entry_type, func.coalesce(func.sum(BillingEntry.amount), 0))
                      .group_by(BillingEntry.entry_type).all())
        month_start = date.today().replace(day=1)
        received = approved.filter(BillingEntry.entry_type == "payment", BillingEntry.entry_date >= month_start) \
            .with_entities(func.coalesce(func.sum(BillingEntry.amount), 0)).scalar()
        pending = db.query(BillingEntry).filter(BillingEntry.firm_id == ctx.firm_id, BillingEntry.status == "pending").all()
        outstanding = sum((b for b in client_balances(db, ctx.firm_id).values() if b > 0), ZERO)
        return {
            "total_fees": Decimal(totals.get("fee", 0)),
            "total_expenses": Decimal(totals.get("expense", 0)),
            "total_payments": Decimal(totals.get("payment", 0)),
            "outstanding": outstanding,
            "pending_count": len(pending),
            "pending_amount": sum((Decimal(e.amount) for e in pending), ZERO),
            "awaiting_my_review": sum(1 for e in pending if self._may_review(ctx, e)),
            "received_this_month": Decimal(received),
        }

    def create(self, ctx: FirmContext, data: dict, db: Session) -> dict:
        client_interactor.get_client(ctx, data["client_id"], db)
        if data.get("matter_id"):
            m = client_interactor.get_matter(ctx, data["matter_id"], db)
            if m.client_id != data["client_id"]:
                raise HTTPException(status_code=400, detail="That case belongs to a different client.")
        e = BillingEntry(firm_id=ctx.firm_id, created_by=ctx.user.id, status="pending",
                         **self._normalise(dict(data), data["entry_type"]))
        db.add(e)
        db.commit()
        db.refresh(e)
        return self._out(ctx, db, [e])[0]

    def update(self, ctx: FirmContext, entry_id: int, changes: dict, db: Session) -> dict:
        e = self._get(ctx, entry_id, db)
        if e.status != "pending":
            raise HTTPException(status_code=409, detail="Only pending entries can be edited. Approved entries are locked.")
        ctx.require(self._may_edit(ctx, e), "Only the person who recorded this entry or a partner can edit it.")
        if changes.get("matter_id"):
            m = client_interactor.get_matter(ctx, changes["matter_id"], db)
            if m.client_id != e.client_id:
                raise HTTPException(status_code=400, detail="That case belongs to a different client.")
        for k, v in self._normalise(dict(changes), e.entry_type).items():
            if v is None and k not in ("matter_id", "reference", "payment_method"):
                continue
            setattr(e, k, v)
        db.commit()
        db.refresh(e)
        return self._out(ctx, db, [e])[0]

    def delete(self, ctx: FirmContext, entry_id: int, db: Session) -> dict:
        e = self._get(ctx, entry_id, db)
        if e.status != "pending":
            raise HTTPException(status_code=409, detail="Only pending entries can be deleted. Void an approved entry instead.")
        ctx.require(self._may_edit(ctx, e), "Only the person who recorded this entry or a partner can delete it.")
        db.delete(e)
        db.commit()
        return {"detail": "Entry deleted."}

    def _review(self, ctx: FirmContext, entry_id: int, db: Session, *, new_status: str, note: Optional[str],
                from_status: str) -> dict:
        e = self._get(ctx, entry_id, db)
        if e.status != from_status:
            raise HTTPException(status_code=409, detail=f"This entry is {e.status}, not {from_status}.")
        ctx.require(ctx.can_approve, "Only an owner or partner can review billing entries.")
        if e.created_by == ctx.user.id and not ctx.firm.allow_self_approval:
            raise HTTPException(status_code=403, detail=(
                "Maker-checker: you recorded this entry, so another partner or the owner must review it. "
                "A solo practice can allow self-approval in Team settings."))
        e.status = new_status
        e.reviewed_by = ctx.user.id
        e.reviewed_at = datetime.now(timezone.utc)
        e.review_note = (note or "").strip() or None
        if new_status == "approved":
            e.self_approved = e.created_by == ctx.user.id
        db.commit()
        db.refresh(e)
        return self._out(ctx, db, [e])[0]

    def approve(self, ctx, entry_id, note, db):
        return self._review(ctx, entry_id, db, new_status="approved", note=note, from_status="pending")

    def reject(self, ctx, entry_id, note, db):
        if not (note or "").strip():
            raise HTTPException(status_code=400, detail="Please give a reason for rejecting.")
        return self._review(ctx, entry_id, db, new_status="rejected", note=note, from_status="pending")

    def void(self, ctx, entry_id, note, db):
        if not (note or "").strip():
            raise HTTPException(status_code=400, detail="Please give a reason for voiding.")
        return self._review(ctx, entry_id, db, new_status="voided", note=note, from_status="approved")

    def statement(self, ctx: FirmContext, client_id: int, date_from: Optional[date], date_to: Optional[date],
                  db: Session) -> dict:
        client = client_interactor.get_client(ctx, client_id, db)
        base = db.query(BillingEntry).filter(BillingEntry.firm_id == ctx.firm_id,
                                             BillingEntry.client_id == client.id,
                                             BillingEntry.status == "approved")
        opening = ZERO
        if date_from:
            opening = sum((_charge(e) for e in base.filter(BillingEntry.entry_date < date_from).all()), ZERO)
            base = base.filter(BillingEntry.entry_date >= date_from)
        if date_to:
            base = base.filter(BillingEntry.entry_date <= date_to)
        entries = base.order_by(BillingEntry.entry_date.asc(), BillingEntry.id.asc()).all()
        matters = dict(db.query(Matter.id, Matter.title).filter(Matter.client_id == client.id).all())
        balance, lines = opening, []
        totals = {"charges": ZERO, "payments": ZERO}
        entries = [e for e in entries if not (e.entry_type == "expense" and not e.billable)]
        for e in entries:
            amt = _charge(e)
            balance += amt
            if e.entry_type == "payment":
                totals["payments"] += Decimal(e.amount)
            else:
                totals["charges"] += amt
            label = {"fee": "Professional fee", "expense": "Expense", "payment": "Payment received"}[e.entry_type]
            lines.append({
                "date": e.entry_date, "type": label, "description": e.description,
                "matter": matters.get(e.matter_id), "reference": e.reference,
                "charge": amt if e.entry_type != "payment" else None,
                "payment": Decimal(e.amount) if e.entry_type == "payment" else None,
                "balance": balance,
            })
        pending = db.query(func.count(BillingEntry.id)).filter(
            BillingEntry.firm_id == ctx.firm_id, BillingEntry.client_id == client.id,
            BillingEntry.status == "pending").scalar()
        return {"firm_name": ctx.firm.name, "client": client, "date_from": date_from, "date_to": date_to,
                "opening": opening, "lines": lines, "total_charges": totals["charges"],
                "total_payments": totals["payments"], "closing": balance, "pending_excluded": pending,
                "generated_by": ctx.user.full_name}


billing_interactor = BillingInteractor()
