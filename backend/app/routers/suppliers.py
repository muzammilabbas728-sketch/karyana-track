"""Supplier management router for purchase credit (khata) tracking and payments."""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import transaction
from ..models import (
    SupplierCreate,
    SupplierPaymentCreate,
    SupplierPaymentResponse,
    SupplierResponse,
)
from .auth import require_role

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


def _format_iso_utc(ts: Any) -> Any:
    if not ts:
        return ts
    s = str(ts).strip()
    if not s:
        return ts
    if " " in s and "T" not in s:
        s = s.replace(" ", "T")
    if not s.endswith("Z") and "+" not in s and "-" not in s[10:]:
        s += "Z"
    return s


def _compute_supplier_balance(cursor: Any, supplier_id: int, supplier_name: str) -> float:
    """Compute the net balance owed to a supplier (unpaid purchase costs minus supplier payments)."""
    purchases_row = cursor.execute(
        """
        SELECT COALESCE(SUM(total_cost - amount_paid), 0)
        FROM inventory_purchases
        WHERE (supplier_id = ? OR (supplier_id IS NULL AND supplier_name = ?))
          AND payment_status != 'paid'
          AND status = 'active'
        """,
        (supplier_id, supplier_name),
    ).fetchone()
    total_unpaid_purchases = float(purchases_row[0]) if purchases_row else 0.0

    payments_row = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE supplier_id = ?",
        (supplier_id,),
    ).fetchone()
    total_payments = float(payments_row[0]) if payments_row else 0.0

    return round(total_unpaid_purchases - total_payments, 2)


@router.get("", response_model=List[SupplierResponse])
def list_suppliers(
    current_user: dict = Depends(require_role("owner")),
) -> List[SupplierResponse]:
    """Retrieve all suppliers with computed balances owed (owner only)."""
    with transaction() as cursor:
        rows = cursor.execute(
            "SELECT id, name, phone, created_at FROM suppliers ORDER BY id"
        ).fetchall()

        result = []
        for row in rows:
            balance = _compute_supplier_balance(cursor, row["id"], row["name"])
            result.append(
                SupplierResponse(
                    id=row["id"],
                    name=row["name"],
                    phone=row["phone"],
                    created_at=row["created_at"],
                    balance_owed=balance,
                )
            )

    return result


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    current_user: dict = Depends(require_role("owner")),
) -> SupplierResponse:
    """Create a new supplier profile (owner only)."""
    name_clean = payload.name.strip()
    phone_clean = payload.phone.strip() if payload.phone else None

    with transaction() as cursor:
        existing = cursor.execute(
            "SELECT id FROM suppliers WHERE name = ?",
            (name_clean,),
        ).fetchone()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier '{name_clean}' already exists.",
            )

        cursor.execute(
            "INSERT INTO suppliers (name, phone) VALUES (?, ?)",
            (name_clean, phone_clean),
        )
        supplier_id = cursor.lastrowid
        row = cursor.execute(
            "SELECT id, name, phone, created_at FROM suppliers WHERE id = ?",
            (supplier_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    return SupplierResponse(
        id=row["id"],
        name=row["name"],
        phone=row["phone"],
        created_at=row["created_at"],
        balance_owed=0.0,
    )


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> SupplierResponse:
    """Retrieve a single supplier profile with balance owed (owner only)."""
    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, name, phone, created_at FROM suppliers WHERE id = ?",
            (supplier_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

        balance = _compute_supplier_balance(cursor, supplier_id, row["name"])

    return SupplierResponse(
        id=row["id"],
        name=row["name"],
        phone=row["phone"],
        created_at=row["created_at"],
        balance_owed=balance,
    )


@router.get("/{supplier_id}/history", response_model=List[Dict[str, Any]])
def get_supplier_history(
    supplier_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> List[Dict[str, Any]]:
    """Retrieve combined chronological purchase and payment history for a supplier (owner only)."""
    with transaction() as cursor:
        supplier = cursor.execute(
            "SELECT id, name FROM suppliers WHERE id = ?",
            (supplier_id,),
        ).fetchone()

        if supplier is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

        supplier_name = supplier["name"]

        purchases_rows = cursor.execute(
            """
            SELECT id, total_cost, amount_paid, payment_status, status, created_at
            FROM inventory_purchases
            WHERE supplier_id = ? OR (supplier_id IS NULL AND supplier_name = ?)
            ORDER BY created_at DESC
            """,
            (supplier_id, supplier_name),
        ).fetchall()

        purchases_data = []
        for p_row in purchases_rows:
            p_id = p_row["id"]
            item_rows = cursor.execute(
                """
                SELECT p.name AS product_name, pi.quantity, pi.cost_price, pi.total_cost
                FROM purchase_items pi
                JOIN products p ON p.id = pi.product_id
                WHERE pi.purchase_id = ?
                """,
                (p_id,),
            ).fetchall()

            items = [
                {
                    "product_name": i_row["product_name"],
                    "quantity": i_row["quantity"],
                    "cost_price": float(i_row["cost_price"]),
                    "total_cost": float(i_row["total_cost"]),
                }
                for i_row in item_rows
            ]

            purchases_data.append({
                "id": p_row["id"],
                "type": "purchase",
                "total_cost": float(p_row["total_cost"]),
                "amount_paid": float(p_row["amount_paid"] or 0),
                "payment_status": p_row["payment_status"],
                "status": p_row["status"],
                "created_at": _format_iso_utc(p_row["created_at"]),
                "items": items,
            })

        payment_rows = cursor.execute(
            """
            SELECT sp.id, sp.amount, u.name AS user_name, sp.created_at
            FROM supplier_payments sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.supplier_id = ?
            """,
            (supplier_id,),
        ).fetchall()

    history: List[Dict[str, Any]] = []

    for p in purchases_data:
        history.append(p)

    for row in payment_rows:
        history.append({
            "id": row["id"],
            "type": "payment",
            "amount": float(row["amount"]),
            "user_name": row["user_name"],
            "created_at": _format_iso_utc(row["created_at"]),
            "items": [],
        })

    history.sort(key=lambda item: str(item["created_at"]), reverse=True)
    return history


@router.post("/{supplier_id}/payments", response_model=SupplierPaymentResponse, status_code=status.HTTP_201_CREATED)
def record_supplier_payment(
    supplier_id: int,
    payload: SupplierPaymentCreate,
    current_user: dict = Depends(require_role("owner")),
) -> SupplierPaymentResponse:
    """Record a payment to a supplier (owner only)."""
    with transaction() as cursor:
        supplier = cursor.execute(
            "SELECT id FROM suppliers WHERE id = ?",
            (supplier_id,),
        ).fetchone()

        if supplier is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

        cursor.execute(
            "INSERT INTO supplier_payments (supplier_id, user_id, amount) VALUES (?, ?, ?)",
            (supplier_id, current_user["id"], payload.amount),
        )
        payment_id = cursor.lastrowid

        payment_row = cursor.execute(
            """
            SELECT sp.id, sp.supplier_id, sp.user_id, sp.amount, u.name AS user_name, sp.created_at
            FROM supplier_payments sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.id = ?
            """,
            (payment_id,),
        ).fetchone()

    if payment_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")

    return SupplierPaymentResponse(
        id=payment_row["id"],
        supplier_id=payment_row["supplier_id"],
        user_id=payment_row["user_id"],
        user_name=payment_row["user_name"],
        amount=float(payment_row["amount"]),
        created_at=payment_row["created_at"],
    )
