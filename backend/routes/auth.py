from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.database.migrations.user import User
from backend.interactors.auth_interactor import auth_interactor
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

router = APIRouter()


@router.post("/auth/signup", response_model=TokenResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    return auth_interactor.signup(req, db)


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    return auth_interactor.login(req, db)


@router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(auth_interactor.resolve_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/auth/profile", response_model=UserResponse)
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return auth_interactor.update_profile(req, current_user, db)


@router.post("/auth/profile/picture", response_model=UserResponse)
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return await auth_interactor.upload_profile_picture(file, current_user, db)


@router.post("/auth/phone/send-code")
def send_phone_code(
    req: SendCodeRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
):
    return auth_interactor.send_phone_code(req, current_user)


@router.post("/auth/phone/verify", response_model=UserResponse)
def verify_phone_code(
    req: VerifyCodeRequest,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return auth_interactor.verify_phone_code(req, current_user, db)


@router.post("/auth/phone/verify-firebase", response_model=UserResponse)
def verify_firebase_phone(
    req: FirebasePhoneVerify,
    current_user: User = Depends(auth_interactor.resolve_current_user),
    db: Session = Depends(get_db),
):
    return auth_interactor.verify_firebase_phone(req, current_user, db)


@router.post("/auth/google", response_model=TokenResponse)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    return auth_interactor.google_auth(req, db)
