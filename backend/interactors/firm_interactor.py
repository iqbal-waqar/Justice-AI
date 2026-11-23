from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.database.migrations.firm import APPROVER_ROLES, FIRM_ROLES, Firm, FirmInvitation, FirmMember
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor


@dataclass
class FirmContext:
    user: User
    member: FirmMember
    firm: Firm

    @property
    def firm_id(self) -> int:
        return self.firm.id

    @property
    def role(self) -> str:
        return self.member.role

    @property
    def can_approve(self) -> bool:
        return self.member.role in APPROVER_ROLES

    @property
    def is_owner(self) -> bool:
        return self.member.role == "owner"

    def require(self, allowed: bool, message: str) -> None:
        if not allowed:
            raise HTTPException(status_code=403, detail=message)


def get_or_create_membership(user: User, db: Session) -> FirmMember:
    member = db.query(FirmMember).filter(FirmMember.user_id == user.id).first()
    if member:
        return member
    firm = Firm(name=f"{(user.full_name or 'My').strip()}'s Practice")
    db.add(firm)
    db.flush()
    member = FirmMember(firm_id=firm.id, user_id=user.id, role="owner")
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def current_firm(
    user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
) -> FirmContext:
    member = get_or_create_membership(user, db)
    return FirmContext(user=user, member=member, firm=member.firm)


class FirmInteractor:
    def _member_out(self, m: FirmMember) -> dict:
        return {"id": m.id, "user_id": m.user_id, "full_name": m.user.full_name, "email": m.user.email,
                "role": m.role, "joined_at": m.created_at}

    def _invites_out(self, invites) -> list:
        return [{"id": i.id, "firm_id": i.firm_id, "firm_name": i.firm.name, "email": i.email, "role": i.role,
                 "status": i.status, "created_at": i.created_at} for i in invites]

    def get_firm(self, ctx: FirmContext, db: Session = None) -> dict:
        members = sorted(ctx.firm.members, key=lambda m: (FIRM_ROLES.index(m.role) if m.role in FIRM_ROLES else 9, m.id))
        return {
            "id": ctx.firm.id,
            "name": ctx.firm.name,
            "allow_self_approval": ctx.firm.allow_self_approval,
            "my_role": ctx.role,
            "my_user_id": ctx.user.id,
            "can_approve": ctx.can_approve,
            "approver_count": sum(1 for m in ctx.firm.members if m.role in APPROVER_ROLES),
            "members": [self._member_out(m) for m in members],
            "sent_invitations": self._invites_out(
                db.query(FirmInvitation).filter(FirmInvitation.firm_id == ctx.firm_id,
                                                FirmInvitation.status == "pending").all()
            ) if (db is not None and ctx.is_owner) else [],
            "my_invitations": self._invites_out(
                db.query(FirmInvitation).filter(FirmInvitation.email == (ctx.user.email or "").lower(),
                                                FirmInvitation.status == "pending",
                                                FirmInvitation.firm_id != ctx.firm_id).all()
            ) if db is not None else [],
        }

    def update_firm(self, ctx: FirmContext, data: dict, db: Session) -> dict:
        ctx.require(ctx.is_owner, "Only the firm owner can change firm settings.")
        if data.get("name") is not None:
            ctx.firm.name = data["name"].strip()
        if data.get("allow_self_approval") is not None:
            ctx.firm.allow_self_approval = bool(data["allow_self_approval"])
        db.commit()
        db.refresh(ctx.firm)
        return self.get_firm(ctx, db)

    def invite(self, ctx: FirmContext, email: str, role: str, db: Session) -> dict:
        ctx.require(ctx.is_owner, "Only the firm owner can invite team members.")
        if role not in FIRM_ROLES or role == "owner":
            raise HTTPException(status_code=400, detail="Role must be partner, associate or clerk.")
        email = email.strip().lower()
        if any((m.user.email or "").lower() == email for m in ctx.firm.members):
            raise HTTPException(status_code=409, detail="That person is already in your firm.")
        existing = db.query(FirmInvitation).filter(FirmInvitation.firm_id == ctx.firm_id, FirmInvitation.email == email,
                                                   FirmInvitation.status == "pending").first()
        if existing:
            existing.role = role
        else:
            db.add(FirmInvitation(firm_id=ctx.firm_id, email=email, role=role, invited_by=ctx.user.id))
        db.commit()
        return self.get_firm(ctx, db)

    def revoke_invitation(self, ctx: FirmContext, invitation_id: int, db: Session) -> dict:
        ctx.require(ctx.is_owner, "Only the firm owner can cancel invitations.")
        inv = db.query(FirmInvitation).filter(FirmInvitation.id == invitation_id, FirmInvitation.firm_id == ctx.firm_id,
                                              FirmInvitation.status == "pending").first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        inv.status, inv.responded_at = "revoked", datetime.now(timezone.utc)
        db.commit()
        return self.get_firm(ctx, db)

    def _my_invitation(self, ctx: FirmContext, invitation_id: int, db: Session) -> FirmInvitation:
        inv = db.query(FirmInvitation).filter(FirmInvitation.id == invitation_id, FirmInvitation.status == "pending").first()
        if not inv or inv.email != (ctx.user.email or "").lower():
            raise HTTPException(status_code=404, detail="Invitation not found.")
        return inv

    def accept_invitation(self, ctx: FirmContext, invitation_id: int, db: Session) -> dict:
        inv = self._my_invitation(ctx, invitation_id, db)
        if inv.firm_id == ctx.firm_id:
            raise HTTPException(status_code=409, detail="You are already in that firm.")
        from backend.database.migrations.client import Client
        old_firm = ctx.firm
        others = [m for m in old_firm.members if m.user_id != ctx.user.id]
        has_data = db.query(Client).filter(Client.firm_id == old_firm.id).count() > 0
        if ctx.is_owner and (others or has_data):
            raise HTTPException(status_code=409, detail=(
                "Your current firm has team members or client records. Remove them before joining another firm."))
        db.delete(ctx.member)
        db.flush()
        if not others:
            db.delete(old_firm)
            db.flush()
        db.add(FirmMember(firm_id=inv.firm_id, user_id=ctx.user.id, role=inv.role))
        inv.status, inv.responded_at = "accepted", datetime.now(timezone.utc)
        db.commit()
        member = db.query(FirmMember).filter(FirmMember.user_id == ctx.user.id).first()
        return self.get_firm(FirmContext(user=ctx.user, member=member, firm=member.firm), db)

    def decline_invitation(self, ctx: FirmContext, invitation_id: int, db: Session) -> dict:
        inv = self._my_invitation(ctx, invitation_id, db)
        inv.status, inv.responded_at = "declined", datetime.now(timezone.utc)
        db.commit()
        return self.get_firm(ctx, db)

    def update_member(self, ctx: FirmContext, member_id: int, role: str, db: Session) -> dict:
        ctx.require(ctx.is_owner, "Only the firm owner can change roles.")
        m = db.query(FirmMember).filter(FirmMember.id == member_id, FirmMember.firm_id == ctx.firm_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Member not found.")
        if m.role == "owner":
            raise HTTPException(status_code=400, detail="The owner's role cannot be changed.")
        if role not in FIRM_ROLES or role == "owner":
            raise HTTPException(status_code=400, detail="Role must be partner, associate or clerk.")
        m.role = role
        db.commit()
        db.refresh(ctx.firm)
        return self.get_firm(ctx, db)

    def remove_member(self, ctx: FirmContext, member_id: int, db: Session) -> dict:
        ctx.require(ctx.is_owner, "Only the firm owner can remove team members.")
        m = db.query(FirmMember).filter(FirmMember.id == member_id, FirmMember.firm_id == ctx.firm_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Member not found.")
        if m.role == "owner":
            raise HTTPException(status_code=400, detail="The owner cannot be removed.")
        db.delete(m)
        db.commit()
        db.refresh(ctx.firm)
        return self.get_firm(ctx, db)


firm_interactor = FirmInteractor()
