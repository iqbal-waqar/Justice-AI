from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.interactors.firm_interactor import FirmContext, current_firm, firm_interactor
from backend.schemas import FirmOut, FirmUpdate, InvitationIn, MemberUpdate

router = APIRouter()


@router.get("/firm", response_model=FirmOut)
def get_firm(ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.get_firm(ctx, db)


@router.put("/firm", response_model=FirmOut)
def update_firm(body: FirmUpdate, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.update_firm(ctx, body.model_dump(exclude_unset=True), db)


@router.post("/firm/invitations", response_model=FirmOut)
def invite(body: InvitationIn, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.invite(ctx, body.email, body.role, db)


@router.delete("/firm/invitations/{invitation_id}", response_model=FirmOut)
def revoke_invitation(invitation_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.revoke_invitation(ctx, invitation_id, db)


@router.post("/firm/invitations/{invitation_id}/accept", response_model=FirmOut)
def accept_invitation(invitation_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.accept_invitation(ctx, invitation_id, db)


@router.post("/firm/invitations/{invitation_id}/decline", response_model=FirmOut)
def decline_invitation(invitation_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.decline_invitation(ctx, invitation_id, db)


@router.put("/firm/members/{member_id}", response_model=FirmOut)
def update_member(member_id: int, body: MemberUpdate, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.update_member(ctx, member_id, body.role, db)


@router.delete("/firm/members/{member_id}", response_model=FirmOut)
def remove_member(member_id: int, ctx: FirmContext = Depends(current_firm), db: Session = Depends(get_db)):
    return firm_interactor.remove_member(ctx, member_id, db)
