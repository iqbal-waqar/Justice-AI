from pydantic import BaseModel, EmailStr
from typing import Optional

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str]
    phone_verified: bool = False
    bar_council_id: Optional[str]
    specialization: Optional[str]
    city: Optional[str]
    notification_email: Optional[str]
    profile_picture: Optional[str]
    role: str
    bio: Optional[str] = None
    practice_areas: Optional[str] = None
    experience_years: Optional[int] = None
    courts: Optional[str] = None
    languages: Optional[str] = None
    directory_listed: bool = False
    directory_complete: bool = False
    tip_email: bool = True
    tip_whatsapp: bool = True
    tip_language: str = 'en'
    class Config:
        from_attributes = True

class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    bar_council_id: Optional[str] = None
    specialization: Optional[str] = None
    city: Optional[str] = None
    notification_email: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    bar_council_id: Optional[str] = None
    specialization: Optional[str] = None
    city: Optional[str] = None
    notification_email: Optional[str] = None
    bio: Optional[str] = None
    practice_areas: Optional[str] = None
    experience_years: Optional[int] = None
    courts: Optional[str] = None
    languages: Optional[str] = None
    directory_listed: Optional[bool] = None
    tip_email: Optional[bool] = None
    tip_whatsapp: Optional[bool] = None
    tip_language: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SignupResponse(BaseModel):
    verification_required: bool = True
    email: str
    message: str


class EmailCodeRequest(BaseModel):
    email: EmailStr
    code: str


class EmailResendRequest(BaseModel):
    email: EmailStr


class SendCodeRequest(BaseModel):
    phone: str


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str


class GoogleAuthRequest(BaseModel):
    credential: str
