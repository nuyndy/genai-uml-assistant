import base64
import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User
from schemas.auth import AuthResponse, GoogleLoginSchema, UserSchema

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 ngày


# ---------------------------------------------------------------------------
# Session token: chuỗi tự ký dạng base64(payload).hmac_hex — không cần thư viện ngoài.
# ---------------------------------------------------------------------------
def _sign(payload: dict) -> str:
    raw = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()
    sig = hmac.new(SECRET_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def _verify_token(token: str) -> Optional[dict]:
    try:
        raw, sig = token.split(".", 1)
        expected = hmac.new(
            SECRET_KEY.encode(), raw.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(raw.encode()))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Dependency bảo vệ API: yêu cầu header 'Authorization: Bearer <token>'."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    payload = _verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == payload.get("uid")).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại.",
        )
    return user


# ---------------------------------------------------------------------------
# Đăng nhập bằng Google
# ---------------------------------------------------------------------------
def _verify_google_token(credential: str) -> dict:
    """Xác minh ID token với Google (dùng urllib — không cần thư viện ngoài).

    Trả về payload gồm email, name, picture, sub.
    """
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode(
        {"id_token": credential}
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            info = json.loads(resp.read().decode())
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token không hợp lệ.",
        )

    # Nếu đã cấu hình CLIENT_ID thì audience phải khớp.
    if GOOGLE_CLIENT_ID and info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token không thuộc ứng dụng này.",
        )

    if not info.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token thiếu thông tin email.",
        )
    return info


@router.post("/google", response_model=AuthResponse)
def google_login(data: GoogleLoginSchema, db: Session = Depends(get_db)):
    """Nhận credential từ Google, tạo/cập nhật user trong DB và trả session token."""
    info = _verify_google_token(data.credential)

    email = info["email"]
    google_id = info.get("sub")
    name = info.get("name")
    avatar_url = info.get("picture")

    user = db.query(User).filter(User.email == email).first()
    if user:
        # Cập nhật thông tin hồ sơ từ Google.
        user.name = name or user.name
        user.avatar_url = avatar_url or user.avatar_url
        user.google_id = google_id or user.google_id
    else:
        user = User(
            email=email,
            name=name,
            avatar_url=avatar_url,
            google_id=google_id,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    token = _sign(
        {"uid": user.id, "email": user.email, "exp": time.time() + TOKEN_TTL_SECONDS}
    )
    return AuthResponse(access_token=token, user=UserSchema.model_validate(user))


@router.get("/me", response_model=UserSchema)
def me(current_user: User = Depends(get_current_user)):
    """Trả về người dùng hiện tại"""
    return UserSchema.model_validate(current_user)
