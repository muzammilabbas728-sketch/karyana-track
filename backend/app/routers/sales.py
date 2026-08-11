"""Sales routes for creating sales transactions."""

from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status

from .auth import get_current_user
from ..database import transaction
from ..models import SaleCreate, SaleItemResponse, SaleResponse

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(sale: SaleCreate, current_user: dict = Depends(get_current_user)) -> SaleResponse:
    """Create a sale atomically while snapshotting server-side prices and stock updates.

    The endpoint uses a single transaction so the sale, sale items, and stock changes
    are all committed or rolled back together. Prices are snapped from the database at
    the time of sale to avoid trusting client-provided values.
    """
    # TODO: replace hardcoded user_id with the authenticated user's id once auth exists.
    user_id = 1
    now = datetime.utcnow()

    with transaction() as cursor:
        cursor.execute(
            "INSERT INTO sales (user_id, total_amount, total_profit, created_at) VALUES (?, 0, 0, ?)",
            (user_id, now),
        )
        sale_id = cursor.lastrowid

        total_amount = 0.0
        total_profit = 0.0

        for item in sale.items:
            product_row = cursor.execute(
                "SELECT id, name, selling_price, cost_price, quantity_in_stock, unit_type FROM products WHERE id = ? AND is_active = 1",
                (item.product_id,),
            ).fetchone()

            if product_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product {item.product_id} not found",
                )

            if product_row["quantity_in_stock"] < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for product {product_row['name']}",
                )

            if product_row["unit_type"] == "weight":
                unit_price = float(product_row["selling_price"]) / 1000
                unit_cost = float(product_row["cost_price"]) / 1000
            else:
                unit_price = float(product_row["selling_price"])
                unit_cost = float(product_row["cost_price"])

            line_total = unit_price * item.quantity
            line_profit = (unit_price - unit_cost) * item.quantity

            cursor.execute(
                """
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost)
                VALUES (?, ?, ?, ?, ?)
                """,
                (sale_id, item.product_id, item.quantity, unit_price, unit_cost),
            )

            cursor.execute(
                "UPDATE products SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?",
                (item.quantity, item.product_id),
            )

            total_amount += line_total
            total_profit += line_profit

        cursor.execute(
            "UPDATE sales SET total_amount = ?, total_profit = ? WHERE id = ?",
            (round(total_amount, 2), round(total_profit, 2), sale_id),
        )

    with transaction() as cursor:
        sale_row = cursor.execute(
            "SELECT id, user_id, total_amount, total_profit, created_at FROM sales WHERE id = ?",
            (sale_id,),
        ).fetchone()
        item_rows = cursor.execute(
            """
            SELECT si.product_id, p.name AS product_name, si.quantity, si.unit_price, si.unit_cost,
                   si.quantity * si.unit_price AS line_total
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = ?
            ORDER BY si.id
            """,
            (sale_id,),
        ).fetchall()

    if sale_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")

    return SaleResponse(
        id=sale_row["id"],
        user_id=sale_row["user_id"],
        total_amount=float(round(sale_row["total_amount"], 2)),
        total_profit=float(round(sale_row["total_profit"], 2)),
        created_at=sale_row["created_at"],
        items=[
            SaleItemResponse(
                product_id=row["product_id"],
                product_name=row["product_name"],
                quantity=row["quantity"],
                unit_price=float(row["unit_price"]),
                unit_cost=float(row["unit_cost"]),
                line_total=float(row["line_total"]),
            )
            for row in item_rows
        ],
    )
