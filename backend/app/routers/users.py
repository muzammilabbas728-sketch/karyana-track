"""User routes for managing application users."""

import sqlite3
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import transaction
from ..models import PinChangeRequest, UserCreate, UserResponse
from .auth import get_current_user, hash_pin, require_role

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
def get_users(current_user: dict = Depends(require_role("owner"))) -> List[UserResponse]:
    """Retrieve all users ordered by ID (owner only)."""
    with transaction() as cursor:
        rows = cursor.execute(
            "SELECT id, name, username, role, created_at FROM users ORDER BY id"
        ).fetchall()

    return [UserResponse.model_validate(dict(row)) for row in rows]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: dict = Depends(require_role("owner")),
) -> UserResponse:
    """Create a new user with a hashed PIN and return the user record (owner only)."""
    pin_hash = hash_pin(payload.pin)
    try:
        with transaction() as cursor:
            cursor.execute(
                "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
                (payload.name, payload.username, pin_hash, payload.role),
            )
            user_id = cursor.lastrowid
            row = cursor.execute(
                "SELECT id, name, username, role, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        ) from e

    return UserResponse.model_validate(dict(row))


@router.put("/{user_id}/pin")
def update_user_pin(
    user_id: int,
    payload: PinChangeRequest,
    current_user: dict = Depends(require_role("owner")),
) -> dict:
    """Update a user's PIN by user ID (owner only)."""
    hashed_pin = hash_pin(payload.new_pin)
    with transaction() as cursor:
        cursor.execute(
            "UPDATE users SET pin_hash = ? WHERE id = ?",
            (hashed_pin, user_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

    return {"detail": "PIN updated successfully"}
