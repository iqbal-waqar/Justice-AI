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

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SendCodeRequest(BaseModel):
    phone: str


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str


class FirebasePhoneVerify(BaseModel):
    phone: str


class GoogleAuthRequest(BaseModel):
    credential: str
