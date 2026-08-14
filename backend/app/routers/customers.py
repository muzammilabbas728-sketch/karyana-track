"""Customer management router for credit tracking and payments."""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import transaction
from ..models import (
    CustomerCreate,
    CustomerPaymentCreate,
    CustomerPaymentResponse,
    CustomerResponse,
)
from .auth import get_current_user, require_role

router = APIRouter(prefix="/customers", tags=["customers"])


def _compute_balance(cursor: Any, customer_id: int) -> float:
    """Compute the net credit balance for a customer (credit sales minus payments)."""
    credit_sales_row = cursor.execute(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE customer_id = ? AND payment_status = 'credit'",
        (customer_id,),
    ).fetchone()
    total_sales = float(credit_sales_row[0]) if credit_sales_row else 0.0

    payments_row = cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM customer_payments WHERE customer_id = ?",
        (customer_id,),
    ).fetchone()
    total_payments = float(payments_row[0]) if payments_row else 0.0

    return round(total_sales - total_payments, 2)


@router.get("", response_model=List[CustomerResponse])
def list_customers(current_user: dict = Depends(get_current_user)) -> List[CustomerResponse]:
    """Retrieve all customers with their computed credit balances."""
    with transaction() as cursor:
        rows = cursor.execute(
            "SELECT id, name, phone, credit_limit, created_at FROM customers ORDER BY id"
        ).fetchall()

        result = []
        for row in rows:
            balance = _compute_balance(cursor, row["id"])
            result.append(
                CustomerResponse(
                    id=row["id"],
                    name=row["name"],
                    phone=row["phone"],
                    credit_limit=row["credit_limit"],
                    created_at=row["created_at"],
                    balance=balance,
                )
            )

    return result


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    current_user: dict = Depends(get_current_user),
) -> CustomerResponse:
    """Create a new customer account."""
    name_clean = payload.name.strip()
    phone_clean = payload.phone.strip() if payload.phone else None

    with transaction() as cursor:
        cursor.execute(
            "INSERT INTO customers (name, phone, credit_limit) VALUES (?, ?, ?)",
            (name_clean, phone_clean, payload.credit_limit),
        )
        customer_id = cursor.lastrowid
        row = cursor.execute(
            "SELECT id, name, phone, credit_limit, created_at FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    return CustomerResponse(
        id=row["id"],
        name=row["name"],
        phone=row["phone"],
        credit_limit=row["credit_limit"],
        created_at=row["created_at"],
        balance=0.0,
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    current_user: dict = Depends(get_current_user),
) -> CustomerResponse:
    """Retrieve a single customer by ID with computed credit balance."""
    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, name, phone, credit_limit, created_at FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        balance = _compute_balance(cursor, customer_id)

    return CustomerResponse(
        id=row["id"],
        name=row["name"],
        phone=row["phone"],
        credit_limit=row["credit_limit"],
        created_at=row["created_at"],
        balance=balance,
    )


@router.get("/{customer_id}/history", response_model=List[Dict[str, Any]])
def get_customer_history(
    customer_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> List[Dict[str, Any]]:
    """Retrieve combined chronological credit sales and payment history for a customer (owner only)."""
    with transaction() as cursor:
        customer = cursor.execute(
            "SELECT id FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()

        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        sales_rows = cursor.execute(
            "SELECT id, total_amount, created_at FROM sales WHERE customer_id = ? AND payment_status = 'credit'",
            (customer_id,),
        ).fetchall()

        sales_data = []
        for s_row in sales_rows:
            sale_id = s_row["id"]
            item_rows = cursor.execute(
                "SELECT p.name AS product_name, si.quantity, si.unit_price, si.quantity * si.unit_price AS line_total "
                "FROM sale_items si "
                "JOIN products p ON p.id = si.product_id "
                "WHERE si.sale_id = ?",
                (sale_id,),
            ).fetchall()

            items = [
                {
                    "product_name": i_row["product_name"],
                    "quantity": i_row["quantity"],
                    "unit_price": float(i_row["unit_price"]),
                    "line_total": float(i_row["line_total"]),
                }
                for i_row in item_rows
            ]

            sales_data.append({
                "id": s_row["id"],
                "type": "sale",
                "amount": float(s_row["total_amount"]),
                "created_at": s_row["created_at"],
                "items": items,
            })

        payment_rows = cursor.execute(
            "SELECT id, amount, created_at FROM customer_payments WHERE customer_id = ?",
            (customer_id,),
        ).fetchall()

    history: List[Dict[str, Any]] = []

    for s in sales_data:
        history.append(s)

    for row in payment_rows:
        history.append({
            "id": row["id"],
            "type": "payment",
            "amount": float(row["amount"]),
            "created_at": row["created_at"],
            "items": [],
        })

    history.sort(key=lambda item: str(item["created_at"]), reverse=True)
    return history


@router.post("/{customer_id}/payments", response_model=CustomerPaymentResponse, status_code=status.HTTP_201_CREATED)
def record_customer_payment(
    customer_id: int,
    payload: CustomerPaymentCreate,
    current_user: dict = Depends(get_current_user),
) -> CustomerPaymentResponse:
    """Record a payment against a customer's credit balance."""
    with transaction() as cursor:
        customer = cursor.execute(
            "SELECT id FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()

        if customer is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        cursor.execute(
            "INSERT INTO customer_payments (customer_id, user_id, amount) VALUES (?, ?, ?)",
            (customer_id, current_user["id"], payload.amount),
        )
        payment_id = cursor.lastrowid

        payment_row = cursor.execute(
            "SELECT cp.id, cp.amount, u.name AS user_name, cp.created_at "
            "FROM customer_payments cp "
            "JOIN users u ON cp.user_id = u.id "
            "WHERE cp.id = ?",
            (payment_id,),
        ).fetchone()

    if payment_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")

    return CustomerPaymentResponse.model_validate(dict(payment_row))
