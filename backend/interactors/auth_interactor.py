import hashlib
import hmac
import os
import random
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import Depends, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from backend.auth import SECRET_KEY, auth_service
from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.database.models import UserRepository
from backend.schemas import (
    EmailCodeRequest,
    EmailResendRequest,
    GoogleAuthRequest,
    LoginRequest,
    ProfileUpdateRequest,
    SendCodeRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserResponse,
    VerifyCodeRequest,
)
from backend.services.notifications import notification_service

security = HTTPBearer()

EMAIL_CODE_MINUTES = 10
EMAIL_CODE_RESEND_SECONDS = 60
EMAIL_CODE_MAX_ATTEMPTS = 5
PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024


class AuthInteractor:
    def __init__(self):
        self.verification_codes: Dict[str, Dict[str, float]] = {}
        self.firebase_project_id = "justiceai-8a364"

    def resolve_current_user(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db),
    ) -> User:
        payload = auth_service.decode_access_token(credentials.credentials)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        repo = UserRepository(db)
        user = repo.get_by_id(int(user_id))
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        return user

    def require_admin(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db),
    ) -> User:
        user = self.resolve_current_user(credentials, db)
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return user

    @staticmethod
    def _hash_email_code(user_id: int, code: str) -> str:
        return hmac.new(SECRET_KEY.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def _aware(dt):
        return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    def _seconds_until_resend(self, user: User) -> int:
        sent = self._aware(user.email_code_sent_at)
        if not sent:
            return 0
        return max(0, int(EMAIL_CODE_RESEND_SECONDS - (datetime.now(timezone.utc) - sent).total_seconds()))

    def _send_email_code(self, user: User, repo: UserRepository) -> None:
        if not notification_service.email_configured():
            raise HTTPException(status_code=503, detail="Email sending is not set up on the server, so the verification code could not be sent.")
        code = f"{secrets.randbelow(1_000_000):06d}"
        if not notification_service.send_verification_email(user.email, user.full_name, code, EMAIL_CODE_MINUTES):
            raise HTTPException(status_code=502, detail="We could not send the verification email. Check the address and try again.")
        now = datetime.now(timezone.utc)
        repo.update(user, {
            "email_code_hash": self._hash_email_code(user.id, code),
            "email_code_expires_at": now + timedelta(minutes=EMAIL_CODE_MINUTES),
            "email_code_sent_at": now,
            "email_code_attempts": 0,
        })

    @staticmethod
    def _send_welcome(user: User) -> None:
        threading.Thread(target=notification_service.send_welcome_email,
                         args=(user.email, user.full_name), daemon=True).start()

    def _token_response(self, user: User) -> TokenResponse:
        token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

    def signup(self, req: SignupRequest, db: Session) -> SignupResponse:
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Choose a password of at least 8 characters.")
        repo = UserRepository(db)
        details = {
            "full_name": req.full_name,
            "password_hash": auth_service.hash_password(req.password),
            "phone": req.phone,
            "bar_council_id": req.bar_council_id,
            "specialization": req.specialization,
            "city": req.city,
            "notification_email": req.notification_email or req.email,
        }
        user = repo.get_by_email(req.email)
        if user and user.email_verified:
            raise HTTPException(status_code=400, detail="This email is already registered. Sign in instead.")
        if user:
            wait = self._seconds_until_resend(user)
            if wait:
                raise HTTPException(status_code=429, detail=f"A code was just sent to this address. Try again in {wait} seconds.")
            user = repo.update(user, details)
        else:
            user = repo.create({**details, "email": req.email, "email_verified": False})
        self._send_email_code(user, repo)
        return SignupResponse(email=user.email, message=f"We sent a 6-digit code to {user.email}.")

    def verify_email(self, req: EmailCodeRequest, db: Session) -> TokenResponse:
        repo = UserRepository(db)
        user = repo.get_by_email(req.email)
        invalid = HTTPException(status_code=400, detail="That code is not correct. Check the email and try again.")
        if not user:
            raise invalid
        if user.email_verified:
            raise HTTPException(status_code=400, detail="This email is already verified. Sign in instead.")
        expires = self._aware(user.email_code_expires_at)
        if not user.email_code_hash or not expires or datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="This code has expired. Request a new one.")
        if user.email_code_attempts >= EMAIL_CODE_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")
        code = "".join(ch for ch in req.code if ch.isdigit())
        if not hmac.compare_digest(self._hash_email_code(user.id, code), user.email_code_hash):
            repo.update(user, {"email_code_attempts": user.email_code_attempts + 1})
            raise invalid
        user = repo.update(user, {"email_verified": True, "email_code_hash": None, "email_code_expires_at": None,
                                  "email_code_attempts": 0})
        self._send_welcome(user)
        return self._token_response(user)

    def resend_email_code(self, req: EmailResendRequest, db: Session) -> dict:
        repo = UserRepository(db)
        user = repo.get_by_email(req.email)
        reply = {"message": "If this address has a sign-up waiting, a new code is on its way."}
        if not user or user.email_verified:
            return reply
        wait = self._seconds_until_resend(user)
        if wait:
            raise HTTPException(status_code=429, detail=f"Please wait {wait} seconds before asking for another code.")
        self._send_email_code(user, repo)
        return reply

    def login(self, req: LoginRequest, db: Session) -> TokenResponse:
        repo = UserRepository(db)
        user = repo.get_by_email(req.email)
        if not user or not auth_service.verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        if not user.email_verified:
            if not self._seconds_until_resend(user):
                self._send_email_code(user, repo)
            raise HTTPException(status_code=403, detail={
                "code": "email_not_verified", "email": user.email,
                "message": f"Confirm your email to continue. We sent a 6-digit code to {user.email}.",
            })
        return self._token_response(user)

    def update_profile(self, req: ProfileUpdateRequest, current_user: User, db: Session) -> UserResponse:
        repo = UserRepository(db)
        updated_user = repo.update(current_user, req.model_dump(exclude_unset=True))
        return UserResponse.model_validate(updated_user)

    async def upload_profile_picture(self, file: UploadFile, current_user: User, db: Session) -> UserResponse:
        from io import BytesIO
        from PIL import Image, ImageOps, UnidentifiedImageError

        content = await file.read(PROFILE_PICTURE_MAX_BYTES + 1)
        if len(content) > PROFILE_PICTURE_MAX_BYTES:
            raise HTTPException(status_code=413, detail="The photo is larger than 5 MB. Please choose a smaller one.")
        try:
            with Image.open(BytesIO(content)) as img:
                if img.format not in ("JPEG", "PNG", "WEBP", "GIF"):
                    raise HTTPException(status_code=400, detail="Please upload a JPG, PNG or WebP image.")
                img = ImageOps.exif_transpose(img).convert("RGB")
                side = min(img.size)
                left, top = (img.width - side) // 2, (img.height - side) // 2
                img = img.crop((left, top, left + side, top + side)).resize((512, 512), Image.LANCZOS)
                out = BytesIO()
                img.save(out, format="JPEG", quality=88, optimize=True)
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise HTTPException(status_code=400, detail="That file is not an image we can read. Please upload a JPG, PNG or WebP photo.")

        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "profiles")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"{current_user.id}_{uuid.uuid4().hex[:12]}.jpg"
        with open(os.path.join(upload_dir, filename), "wb") as output:
            output.write(out.getvalue())

        old = current_user.profile_picture or ""
        if old.startswith("/data/profiles/"):
            try:
                os.remove(os.path.join(upload_dir, os.path.basename(old)))
            except OSError:
                pass

        repo = UserRepository(db)
        updated_user = repo.update(current_user, {"profile_picture": f"/data/profiles/{filename}"})
        return UserResponse.model_validate(updated_user)

    def send_phone_code(self, req: SendCodeRequest, current_user: User):
        phone = self.normalize_phone(req.phone)
        code = str(random.randint(100000, 999999))
        key = f"{current_user.id}:{phone}"
        self.verification_codes[key] = {"code": code, "expires": time.time() + 300}

        if not notification_service.send_whatsapp_verification(phone, code):
            raise HTTPException(status_code=500, detail="Failed to send verification code")

        return {"message": "Verification code sent to WhatsApp", "phone": phone}

    def verify_phone_code(self, req: VerifyCodeRequest, current_user: User, db: Session) -> UserResponse:
        phone = self.normalize_phone(req.phone)
        key = f"{current_user.id}:{phone}"
        stored = self.verification_codes.get(key)

        if not stored:
            raise HTTPException(status_code=400, detail="No verification code found. Request a new one.")
        if time.time() > stored["expires"]:
            del self.verification_codes[key]
            raise HTTPException(status_code=400, detail="Verification code expired. Request a new one.")
        if str(stored["code"]) != req.code:
            raise HTTPException(status_code=400, detail="Invalid verification code")

        del self.verification_codes[key]
        repo = UserRepository(db)
        updated_user = repo.update(current_user, {"phone": phone, "phone_verified": True})
        return UserResponse.model_validate(updated_user)

    def google_auth(self, req: GoogleAuthRequest, db: Session) -> TokenResponse:
        try:
            decoded_token = google_id_token.verify_firebase_token(
                req.credential,
                google_requests.Request(),
                audience=self.firebase_project_id,
            )
        except Exception as exc:
            raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(exc)}")

        email = decoded_token.get("email")
        name = decoded_token.get("name", "")
        picture = decoded_token.get("picture", "")

        if not email:
            raise HTTPException(status_code=401, detail="Google account has no email")

        repo = UserRepository(db)
        user = repo.get_by_email(email)
        if not user:
            user = repo.create(
                {
                    "full_name": name,
                    "email": email,
                    "password_hash": auth_service.hash_password(secrets.token_urlsafe(32)),
                    "notification_email": email,
                    "profile_picture": picture,
                    "email_verified": True,
                }
            )
            self._send_welcome(user)
        else:
            changes = {}
            if not user.email_verified:
                changes.update({"email_verified": True, "email_code_hash": None, "email_code_expires_at": None,
                                "password_hash": auth_service.hash_password(secrets.token_urlsafe(32))})
            if picture and user.profile_picture != picture:
                changes["profile_picture"] = picture
            if name and not user.full_name:
                changes["full_name"] = name
            newly_verified = not user.email_verified
            if changes:
                user = repo.update(user, changes)
            if newly_verified:
                self._send_welcome(user)

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

    def normalize_phone(self, phone: str) -> str:
        normalized = phone.strip().replace(" ", "").replace("-", "")
        if not normalized.startswith("+"):
            normalized = "+92" + normalized.lstrip("0")
        return normalized


auth_interactor = AuthInteractor()
