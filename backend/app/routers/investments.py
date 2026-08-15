"""Capital investment router for owner capital injections."""

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import transaction
from ..models import (
    InvestmentCreate,
    InvestmentResponse,
    InvestmentSummaryResponse,
)
from .auth import require_role

router = APIRouter(prefix="/investments", tags=["investments"])


@router.get("", response_model=InvestmentSummaryResponse)
def get_investments(
    current_user: dict = Depends(require_role("owner")),
) -> InvestmentSummaryResponse:
    """Retrieve owner capital investment summary and history (owner only)."""
    with transaction() as cursor:
        rows = cursor.execute(
            """
            SELECT i.id, i.user_id, u.name AS user_name, i.amount, i.description, i.created_at
            FROM investments i
            JOIN users u ON i.user_id = u.id
            ORDER BY i.id DESC
            """
        ).fetchall()

        total_investment = sum(float(r["amount"]) for r in rows) if rows else 0.0

        records = [
            InvestmentResponse(
                id=row["id"],
                user_id=row["user_id"],
                user_name=row["user_name"],
                amount=float(row["amount"]),
                description=row["description"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    return InvestmentSummaryResponse(
        total_investment=round(total_investment, 2),
        investments=records,
    )


@router.post("", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
def create_investment(
    payload: InvestmentCreate,
    current_user: dict = Depends(require_role("owner")),
) -> InvestmentResponse:
    """Record a new owner capital investment (owner only)."""
    desc_clean = payload.description.strip() if payload.description else None

    with transaction() as cursor:
        cursor.execute(
            "INSERT INTO investments (user_id, amount, description) VALUES (?, ?, ?)",
            (current_user["id"], payload.amount, desc_clean),
        )
        investment_id = cursor.lastrowid

        row = cursor.execute(
            """
            SELECT i.id, i.user_id, u.name AS user_name, i.amount, i.description, i.created_at
            FROM investments i
            JOIN users u ON i.user_id = u.id
            WHERE i.id = ?
            """,
            (investment_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record capital investment",
        )

    return InvestmentResponse(
        id=row["id"],
        user_id=row["user_id"],
        user_name=row["user_name"],
        amount=float(row["amount"]),
        description=row["description"],
        created_at=row["created_at"],
    )
