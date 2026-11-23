import re
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.interactors.billing_interactor import billing_interactor
from backend.interactors.firm_interactor import FirmContext, current_firm
from backend.schemas import BillingEntryIn, BillingEntryOut, BillingEntryUpdate, BillingSummary, ReviewIn
from backend.services.statement_pdf import build_statement_pdf

router = APIRouter()


@router.get("/billing/entries", response_model=List[BillingEntryOut])
def list_entries(client_id: Optional[int] = None, matter_id: Optional[int] = None, entry_type: Optional[str] = None,
                 status: Optional[str] = None, date_from: Optional[date] = None, date_to: Optional[date] = None,
                 awaiting_me: bool = False, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.list_entries(ctx, db, client_id=client_id, matter_id=matter_id, entry_type=entry_type,
                                           status=status, date_from=date_from, date_to=date_to, awaiting_me=awaiting_me)


@router.get("/billing/summary", response_model=BillingSummary)
def summary(ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.summary(ctx, db)


@router.post("/billing/entries", response_model=BillingEntryOut)
def create_entry(body: BillingEntryIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.create(ctx, body.model_dump(), db)


@router.put("/billing/entries/{entry_id}", response_model=BillingEntryOut)
def update_entry(entry_id: int, body: BillingEntryUpdate, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.update(ctx, entry_id, body.model_dump(exclude_unset=True), db)


@router.delete("/billing/entries/{entry_id}")
def delete_entry(entry_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.delete(ctx, entry_id, db)


@router.post("/billing/entries/{entry_id}/approve", response_model=BillingEntryOut)
def approve(entry_id: int, body: ReviewIn = ReviewIn(), ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.approve(ctx, entry_id, body.note, db)


@router.post("/billing/entries/{entry_id}/reject", response_model=BillingEntryOut)
def reject(entry_id: int, body: ReviewIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.reject(ctx, entry_id, body.note, db)


@router.post("/billing/entries/{entry_id}/void", response_model=BillingEntryOut)
def void(entry_id: int, body: ReviewIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return billing_interactor.void(ctx, entry_id, body.note, db)


@router.get("/billing/statement/{client_id}.pdf")
def statement_pdf(client_id: int, date_from: Optional[date] = None, date_to: Optional[date] = None,
                  ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    st = billing_interactor.statement(ctx, client_id, date_from, date_to, db)
    pdf = build_statement_pdf(st)
    safe = re.sub(r"[^A-Za-z0-9]+", "-", st["client"].name).strip("-") or "client"
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="Statement-{safe}-{date.today().isoformat()}.pdf"',
        "Cache-Control": "no-store",
    })
