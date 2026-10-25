import os
import random
import secrets
import time
import uuid
from typing import Dict

from fastapi import Depends, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from backend.auth import auth_service
from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.database.models import UserRepository
from backend.schemas import (
    FirebasePhoneVerify,
    GoogleAuthRequest,
    LoginRequest,
    ProfileUpdateRequest,
    SendCodeRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
    VerifyCodeRequest,
)
from backend.services.notifications import notification_service

security = HTTPBearer()


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

    def signup(self, req: SignupRequest, db: Session) -> TokenResponse:
        repo = UserRepository(db)
        existing = repo.get_by_email(req.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        user = repo.create(
            {
                "full_name": req.full_name,
                "email": req.email,
                "password_hash": auth_service.hash_password(req.password),
                "phone": req.phone,
                "bar_council_id": req.bar_council_id,
                "specialization": req.specialization,
                "city": req.city,
                "notification_email": req.notification_email or req.email,
            }
        )
        token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

    def login(self, req: LoginRequest, db: Session) -> TokenResponse:
        repo = UserRepository(db)
        user = repo.get_by_email(req.email)
        if not user or not auth_service.verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        token = auth_service.create_access_token({"sub": str(user.id), "email": user.email})
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

    def update_profile(self, req: ProfileUpdateRequest, current_user: User, db: Session) -> UserResponse:
        repo = UserRepository(db)
        updated_user = repo.update(current_user, req.model_dump(exclude_unset=True))
        return UserResponse.model_validate(updated_user)

    async def upload_profile_picture(self, file: UploadFile, current_user: User, db: Session) -> UserResponse:
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "profiles")
        os.makedirs(upload_dir, exist_ok=True)

        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
        filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
        file_path = os.path.join(upload_dir, filename)

        content = await file.read()
        with open(file_path, "wb") as output:
            output.write(content)

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

    def verify_firebase_phone(self, req: FirebasePhoneVerify, current_user: User, db: Session) -> UserResponse:
        phone = self.normalize_phone(req.phone)
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
                }
            )
        else:
            changes = {}
            if picture and user.profile_picture != picture:
                changes["profile_picture"] = picture
            if name and not user.full_name:
                changes["full_name"] = name
            if changes:
                user = repo.update(user, changes)

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
