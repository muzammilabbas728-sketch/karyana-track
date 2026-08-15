"""Authentication helpers and auth routes for the backend."""

import secrets
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, Header, HTTPException, status
import bcrypt

from ..database import transaction
from ..models import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_pin(pin: str) -> str:
    """Hash a PIN using bcrypt."""
    pin_bytes = pin.encode("utf-8")[:72]
    return bcrypt.hashpw(pin_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_pin(pin: str, hashed: str) -> bool:
    """Verify a plaintext PIN against a hashed value."""
    try:
        pin_bytes = pin.encode("utf-8")[:72]
        return bcrypt.checkpw(pin_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


def create_session(user_id: int) -> str:
    """Create a new session token for the given user and return it."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=12)

    with transaction() as cursor:
        cursor.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at),
        )

    return token


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    """Authenticate a user and return a session token."""
    with transaction() as cursor:
        user = cursor.execute(
            "SELECT id, username, pin_hash, role, name FROM users WHERE username = ?",
            (payload.username,),
        ).fetchone()

    if user is None or not verify_pin(payload.pin, user["pin_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_session(user["id"])
    return LoginResponse(token=token, role=user["role"], name=user["name"])


def get_current_user(authorization: str = Header(...)) -> Dict[str, Any]:
    """Resolve the current authenticated user from a bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    with transaction() as cursor:
        session = cursor.execute(
            "SELECT token, user_id, expires_at FROM sessions WHERE token = ?",
            (token,),
        ).fetchone()

    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if datetime.utcnow() > datetime.fromisoformat(str(session["expires_at"])):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    with transaction() as cursor:
        user = cursor.execute(
            "SELECT id, username, role, name FROM users WHERE id = ?",
            (session["user_id"],),
        ).fetchone()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "name": user["name"],
    }


def require_role(role: str):
    """Create a dependency that requires a specific user role."""

    def dependency(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if current_user["role"] != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return current_user

    return dependency
