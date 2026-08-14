"""Sales routes for creating sales transactions."""

from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status

from .auth import get_current_user, require_role
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
        if sale.payment_status == "credit" and sale.customer_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="customer_id is required for credit sales",
            )

        if sale.customer_id is not None:
            customer = cursor.execute(
                "SELECT id FROM customers WHERE id = ?",
                (sale.customer_id,),
            ).fetchone()
            if customer is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Customer not found",
                )

        cursor.execute(
            "INSERT INTO sales (user_id, customer_id, total_amount, total_profit, payment_status, created_at) "
            "VALUES (?, ?, 0, 0, ?, ?)",
            (user_id, sale.customer_id, sale.payment_status, now),
        )
        sale_id = cursor.lastrowid

        total_amount = 0.0
        total_profit = 0.0

        for item in sale.items:
            product_row = cursor.execute(
                "SELECT id, name, selling_price, cost_price, quantity_in_stock, unit_type, units_per_pack "
                "FROM products WHERE id = ? AND is_active = 1",
                (item.product_id,),
            ).fetchone()

            if product_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product {item.product_id} not found",
                )

            if product_row["unit_type"] == "pack":
                units_per_pack = product_row["units_per_pack"]
                if item.sell_as_pack:
                    unit_price = float(product_row["selling_price"])
                    unit_cost = float(product_row["cost_price"])
                    stock_deducted = item.quantity * units_per_pack
                else:
                    unit_price = float(product_row["selling_price"]) / units_per_pack
                    unit_cost = float(product_row["cost_price"]) / units_per_pack
                    stock_deducted = item.quantity
            elif product_row["unit_type"] == "weight":
                unit_price = float(product_row["selling_price"]) / 1000
                unit_cost = float(product_row["cost_price"]) / 1000
                stock_deducted = item.quantity
            else:
                unit_price = float(product_row["selling_price"])
                unit_cost = float(product_row["cost_price"])
                stock_deducted = item.quantity

            if product_row["quantity_in_stock"] < stock_deducted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for product {product_row['name']}",
                )

            line_total = unit_price * item.quantity
            line_profit = (unit_price - unit_cost) * item.quantity

            cursor.execute(
                """
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, stock_deducted)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (sale_id, item.product_id, item.quantity, unit_price, unit_cost, stock_deducted),
            )

            cursor.execute(
                "UPDATE products SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?",
                (stock_deducted, item.product_id),
            )

            total_amount += line_total
            total_profit += line_profit

        cursor.execute(
            "UPDATE sales SET total_amount = ?, total_profit = ? WHERE id = ?",
            (round(total_amount, 2), round(total_profit, 2), sale_id),
        )

    with transaction() as cursor:
        sale_row = cursor.execute(
            "SELECT id, user_id, customer_id, total_amount, total_profit, payment_status, created_at "
            "FROM sales WHERE id = ?",
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
        customer_id=sale_row["customer_id"],
        total_amount=float(round(sale_row["total_amount"], 2)),
        total_profit=float(round(sale_row["total_profit"], 2)),
        payment_status=sale_row["payment_status"],
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


@router.post("/{sale_id}/void")
def void_sale(sale_id: int, current_user: dict = Depends(require_role("owner"))) -> dict:
    """Void a sale: restores stock for all items and excludes it from revenue/profit totals. Owner only."""
    with transaction() as cursor:
        sale = cursor.execute("SELECT id, voided FROM sales WHERE id = ?", (sale_id,)).fetchone()
        if sale is None:
            raise HTTPException(status_code=404, detail="Sale not found")
        if sale["voided"]:
            raise HTTPException(status_code=400, detail="Sale is already voided")

        items = cursor.execute(
            "SELECT product_id, stock_deducted FROM sale_items WHERE sale_id = ?", (sale_id,)
        ).fetchall()

        for item in items:
            cursor.execute(
                "UPDATE products SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?",
                (item["stock_deducted"], item["product_id"]),
            )

        cursor.execute(
            "UPDATE sales SET voided = 1, voided_at = ? WHERE id = ?",
            (datetime.utcnow(), sale_id),
        )

    return {"detail": "Sale voided successfully"}


@router.get("")
def list_sales(current_user: dict = Depends(require_role("owner"))) -> list:
    """List recent sales (most recent first, last 50), owner only."""
    with transaction() as cursor:
        rows = cursor.execute(
            "SELECT id, total_amount, total_profit, payment_status, voided, created_at "
            "FROM sales ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
    return [dict(row) for row in rows]
