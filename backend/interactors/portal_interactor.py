"""Client portal and public lawyer directory.

Client portal: a lawyer shares a case with a client's email address. The client
signs in with a one-time email code (no password, no account) and sees the
hearings, fees and receipts of every case shared with that address.

Directory: lawyers who complete their public profile and switch on
"List me in Find a lawyer" appear in a public, searchable list.
"""
import hashlib
import hmac
import secrets
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.auth import SECRET_KEY, auth_service
from backend.database.db import get_db
from backend.database.migrations.billing import BillingEntry
from backend.database.migrations.client import Client, Matter
from backend.database.migrations.firm import Firm, FirmMember
from backend.database.migrations.hearing import Hearing
from backend.database.migrations.portal import CaseShare, ClientLogin
from backend.database.migrations.user import User
from backend.interactors.firm_interactor import FirmContext
from backend.services.notifications import notification_service

CODE_MINUTES = 10
CODE_RESEND_SECONDS = 60
CODE_MAX_ATTEMPTS = 5
CLIENT_TOKEN_DAYS = 7

security = HTTPBearer()


def _now():
    return datetime.now(timezone.utc)


def _aware(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _norm_email(email: str) -> str:
    return (email or "").strip().lower()


class PortalInteractor:
    # ── lawyer side: sharing ─────────────────────────────────────────────────
    def _matter(self, ctx: FirmContext, matter_id: int, db: Session) -> Matter:
        m = db.query(Matter).filter(Matter.id == matter_id, Matter.firm_id == ctx.firm_id).first()
        if not m:
            raise HTTPException(status_code=404, detail="Case not found.")
        return m

    def _share_out(self, s: CaseShare) -> dict:
        return {"id": s.id, "matter_id": s.matter_id, "client_email": s.client_email,
                "shared_by_name": s.sharer.full_name if s.sharer else None,
                "created_at": s.created_at, "revoked_at": s.revoked_at}

    def list_shares(self, ctx: FirmContext, matter_id: int, db: Session) -> list:
        self._matter(ctx, matter_id, db)
        rows = (db.query(CaseShare).filter(CaseShare.matter_id == matter_id, CaseShare.revoked_at.is_(None))
                .order_by(CaseShare.created_at.desc()).all())
        return [self._share_out(s) for s in rows]

    def share(self, ctx: FirmContext, matter_id: int, email: str, db: Session) -> dict:
        m = self._matter(ctx, matter_id, db)
        email = _norm_email(email)
        s = db.query(CaseShare).filter(CaseShare.matter_id == matter_id, CaseShare.client_email == email).first()
        if s and s.revoked_at is None:
            raise HTTPException(status_code=400, detail="This case is already shared with that email.")
        if s:
            s.revoked_at = None
            s.shared_by = ctx.user.id
            s.created_at = _now()
        else:
            s = CaseShare(firm_id=ctx.firm_id, matter_id=matter_id, client_email=email, shared_by=ctx.user.id)
            db.add(s)
        db.commit()
        db.refresh(s)
        threading.Thread(target=notification_service.send_case_shared_email,
                         args=(email, m.client.name, m.title, ctx.user.full_name, ctx.firm.name), daemon=True).start()
        return self._share_out(s)

    def revoke(self, ctx: FirmContext, share_id: int, db: Session) -> dict:
        s = db.query(CaseShare).filter(CaseShare.id == share_id, CaseShare.firm_id == ctx.firm_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Share not found.")
        s.revoked_at = _now()
        db.commit()
        return {"detail": "Access removed."}

    # ── client side: sign-in with an email code ──────────────────────────────
    @staticmethod
    def _hash(email: str, code: str) -> str:
        return hmac.new(SECRET_KEY.encode(), f"client:{email}:{code}".encode(), hashlib.sha256).hexdigest()

    def _active_shares(self, email: str, db: Session) -> List[CaseShare]:
        return (db.query(CaseShare).filter(CaseShare.client_email == email, CaseShare.revoked_at.is_(None))
                .order_by(CaseShare.created_at.desc()).all())

    def request_code(self, email: str, db: Session) -> dict:
        email = _norm_email(email)
        if not self._active_shares(email, db):
            raise HTTPException(status_code=404, detail="No case has been shared with this email address yet. Ask your lawyer to share it from Justice AI.")
        if not notification_service.email_configured():
            raise HTTPException(status_code=503, detail="Email sending is not set up on the server, so the sign-in code could not be sent.")
        login = db.get(ClientLogin, email) or ClientLogin(email=email)
        sent = _aware(login.code_sent_at)
        if sent and (_now() - sent).total_seconds() < CODE_RESEND_SECONDS:
            wait = int(CODE_RESEND_SECONDS - (_now() - sent).total_seconds())
            raise HTTPException(status_code=429, detail=f"A code was sent a moment ago. You can request another in {wait} seconds.")
        code = f"{secrets.randbelow(1_000_000):06d}"
        if not notification_service.send_client_code_email(email, code, CODE_MINUTES):
            raise HTTPException(status_code=502, detail="We could not send the email. Check the address and try again.")
        login.code_hash = self._hash(email, code)
        login.code_expires_at = _now() + timedelta(minutes=CODE_MINUTES)
        login.code_sent_at = _now()
        login.code_attempts = 0
        db.add(login)
        db.commit()
        return {"detail": "Code sent", "email": email, "resend_in": CODE_RESEND_SECONDS}

    def verify_code(self, email: str, code: str, db: Session) -> dict:
        email = _norm_email(email)
        login = db.get(ClientLogin, email)
        expires = _aware(login.code_expires_at) if login else None
        if not login or not login.code_hash or not expires or _now() > expires:
            raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")
        if login.code_attempts >= CODE_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")
        if not hmac.compare_digest(self._hash(email, code.strip()), login.code_hash):
            login.code_attempts += 1
            db.commit()
            raise HTTPException(status_code=400, detail="That code is not correct.")
        login.code_hash = None
        login.code_expires_at = None
        login.last_login_at = _now()
        db.commit()
        token = auth_service.create_access_token({"sub": f"client:{email}", "kind": "client", "email": email},
                                                 expires_delta=timedelta(days=CLIENT_TOKEN_DAYS))
        return {"access_token": token, "email": email}

    def resolve_client(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
        payload = auth_service.decode_access_token(credentials.credentials)
        if not payload or payload.get("kind") != "client" or not payload.get("email"):
            raise HTTPException(status_code=401, detail="Please sign in again.")
        return _norm_email(payload["email"])

    # ── client side: the shared cases ────────────────────────────────────────
    def cases(self, email: str, db: Session) -> list:
        out = []
        for s in self._active_shares(email, db):
            m = s.matter
            if m is None:
                continue
            firm = db.get(Firm, m.firm_id)
            lawyer = s.sharer
            hearings = (db.query(Hearing).filter(Hearing.matter_id == m.id)
                        .order_by(Hearing.hearing_date.desc()).all())
            entries = (db.query(BillingEntry).filter(BillingEntry.matter_id == m.id, BillingEntry.status == "approved")
                       .order_by(BillingEntry.entry_date.desc()).all())
            fees = sum((e.amount for e in entries if e.entry_type == "fee"), Decimal("0"))
            expenses = sum((e.amount for e in entries if e.entry_type == "expense" and e.billable), Decimal("0"))
            paid = sum((e.amount for e in entries if e.entry_type == "payment"), Decimal("0"))
            upcoming = [h.hearing_date for h in hearings if h.status == "upcoming" and h.hearing_date >= _now().date()]
            out.append({
                "share_id": s.id, "matter_id": m.id, "title": m.title, "case_number": m.case_number, "court": m.court,
                "status": m.status, "description": m.description, "client_name": m.client.name,
                "firm_name": firm.name if firm else "", "lawyer_name": lawyer.full_name if lawyer else None,
                "lawyer_phone": lawyer.phone if lawyer else None, "lawyer_email": lawyer.email if lawyer else None,
                "shared_at": s.created_at, "next_hearing": min(upcoming) if upcoming else None,
                "hearings": [{"id": h.id, "hearing_date": h.hearing_date, "hearing_time": str(h.hearing_time)[:5] if h.hearing_time else None,
                              "court": h.court, "status": h.status, "notes": h.notes} for h in hearings],
                "entries": [{"id": e.id, "entry_type": e.entry_type, "amount": e.amount, "entry_date": e.entry_date,
                             "description": e.description, "reference": e.reference, "payment_method": e.payment_method}
                            for e in entries if e.entry_type != "expense" or e.billable],
                "total_fees": fees, "total_expenses": expenses, "total_paid": paid, "balance_due": fees + expenses - paid,
            })
        return out

    # ── public directory ─────────────────────────────────────────────────────
    def _card(self, u: User, firm_names: dict) -> dict:
        return {"id": u.id, "full_name": u.full_name, "city": u.city, "practice_areas": u.practice_area_list,
                "bio": u.bio, "experience_years": u.experience_years, "courts": u.courts, "languages": u.languages,
                "bar_council_id": u.bar_council_id, "phone": u.phone, "email": u.email,
                "profile_picture": u.profile_picture, "firm_name": firm_names.get(u.id), "member_since": u.created_at}

    def _listed(self, db: Session) -> List[User]:
        users = (db.query(User).filter(User.directory_listed.is_(True), User.is_active.is_(True))
                 .order_by(User.full_name.asc()).all())
        return [u for u in users if u.directory_complete]

    def _firm_names(self, db: Session, user_ids) -> dict:
        if not user_ids:
            return {}
        rows = (db.query(FirmMember.user_id, Firm.name).join(Firm, Firm.id == FirmMember.firm_id)
                .filter(FirmMember.user_id.in_(list(user_ids))).all())
        return dict(rows)

    def directory(self, db: Session, city: Optional[str] = None, area: Optional[str] = None, q: Optional[str] = None) -> dict:
        users = self._listed(db)
        cities = sorted({(u.city or "").strip() for u in users if (u.city or "").strip()}, key=str.casefold)
        areas = sorted({a for u in users for a in u.practice_area_list}, key=str.casefold)
        if city:
            users = [u for u in users if (u.city or "").strip().casefold() == city.strip().casefold()]
        if area:
            users = [u for u in users if area.strip().casefold() in {a.casefold() for a in u.practice_area_list}]
        if q:
            needle = q.strip().casefold()
            users = [u for u in users if needle in " ".join(filter(None, [u.full_name, u.city, u.practice_areas, u.bio, u.courts])).casefold()]
        names = self._firm_names(db, [u.id for u in users])
        return {"lawyers": [self._card(u, names) for u in users], "cities": cities, "areas": areas}

    def lawyer(self, lawyer_id: int, db: Session) -> dict:
        u = db.get(User, lawyer_id)
        if not u or not u.directory_listed or not u.is_active or not u.directory_complete:
            raise HTTPException(status_code=404, detail="This lawyer is not listed.")
        return self._card(u, self._firm_names(db, [u.id]))


portal_interactor = PortalInteractor()
