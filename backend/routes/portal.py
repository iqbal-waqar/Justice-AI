from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.interactors.firm_interactor import FirmContext, current_firm
from backend.interactors.portal_interactor import portal_interactor
from backend.schemas import (CaseShareIn, CaseShareOut, ClientCaseOut, ClientCodeRequest, ClientTokenResponse,
                             ClientVerifyRequest, DirectoryOut, LawyerCardOut)

router = APIRouter()


# ── lawyer: share a case with a client ────────────────────────────────────────
@router.get("/matters/{matter_id}/shares", response_model=List[CaseShareOut])
def list_shares(matter_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return portal_interactor.list_shares(ctx, matter_id, db)


@router.post("/matters/{matter_id}/shares", response_model=CaseShareOut)
def share_case(matter_id: int, body: CaseShareIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return portal_interactor.share(ctx, matter_id, body.email, db)


@router.delete("/shares/{share_id}")
def revoke_share(share_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return portal_interactor.revoke(ctx, share_id, db)


# ── client portal ─────────────────────────────────────────────────────────────
@router.post("/client/request-code")
def client_request_code(body: ClientCodeRequest, db: Session = Depends(get_db)):
    return portal_interactor.request_code(body.email, db)


@router.post("/client/verify", response_model=ClientTokenResponse)
def client_verify(body: ClientVerifyRequest, db: Session = Depends(get_db)):
    return portal_interactor.verify_code(body.email, body.code, db)


@router.get("/client/cases", response_model=List[ClientCaseOut])
def client_cases(email: str = Depends(portal_interactor.resolve_client), db: Session = Depends(get_db)):
    return portal_interactor.cases(email, db)


# ── public directory ──────────────────────────────────────────────────────────
@router.get("/lawyers", response_model=DirectoryOut)
def lawyers(city: Optional[str] = None, area: Optional[str] = None, q: Optional[str] = None, db: Session = Depends(get_db)):
    return portal_interactor.directory(db, city, area, q)


@router.get("/lawyers/{lawyer_id}", response_model=LawyerCardOut)
def lawyer(lawyer_id: int, db: Session = Depends(get_db)):
    return portal_interactor.lawyer(lawyer_id, db)
