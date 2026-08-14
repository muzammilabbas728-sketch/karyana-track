"""Report routes for sales and inventory summaries."""

from datetime import date
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query

from .auth import get_current_user, require_role
from ..database import transaction

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
def daily_report(current_user: dict = Depends(require_role("owner"))) -> Dict[str, Any]:
    """Return today's sales summary for owners."""
    with transaction() as cursor:
        row = cursor.execute(
            """
            SELECT
                COUNT(*) AS total_sales_count,
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COALESCE(SUM(total_profit), 0) AS total_profit
            FROM sales
            WHERE date(created_at) = date('now') AND voided = 0
            """
        ).fetchone()

    return {
        "date": date.today().isoformat(),
        "total_sales_count": int(row["total_sales_count"] or 0),
        "total_revenue": float(row["total_revenue"] or 0),
        "total_profit": float(row["total_profit"] or 0),
    }


@router.get("/range")
def range_report(
    from_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    to_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    current_user: dict = Depends(require_role("owner")),
) -> Dict[str, Any]:
    """Return a sales summary for a date range for owners."""
    with transaction() as cursor:
        row = cursor.execute(
            """
            SELECT
                COUNT(*) AS total_sales_count,
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COALESCE(SUM(total_profit), 0) AS total_profit
            FROM sales
            WHERE date(created_at) BETWEEN ? AND ? AND voided = 0
            """,
            (from_date, to_date),
        ).fetchone()

    return {
        "from_date": from_date,
        "to_date": to_date,
        "total_sales_count": int(row["total_sales_count"] or 0),
        "total_revenue": float(row["total_revenue"] or 0),
        "total_profit": float(row["total_profit"] or 0),
    }


@router.get("/range/by-product")
def range_report_by_product(
    from_date: str = Query(...),
    to_date: str = Query(...),
    current_user: dict = Depends(require_role("owner")),
) -> List[Dict[str, Any]]:
    """Return per-product sales breakdown for a date range (owner only)."""
    with transaction() as cursor:
        rows = cursor.execute(
            """
            SELECT p.name AS product_name,
                   SUM(si.quantity) AS total_quantity,
                   SUM(si.quantity * si.unit_price) AS total_revenue,
                   SUM(si.quantity * (si.unit_price - si.unit_cost)) AS total_profit
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            WHERE date(s.created_at) BETWEEN ? AND ? AND s.voided = 0
            GROUP BY si.product_id
            ORDER BY total_revenue DESC
            """,
            (from_date, to_date),
        ).fetchall()

    return [
        {
            "product_name": row["product_name"],
            "total_quantity": row["total_quantity"],
            "total_revenue": round(float(row["total_revenue"]), 2),
            "total_profit": round(float(row["total_profit"]), 2),
        }
        for row in rows
    ]



@router.get("/low-stock")
def low_stock_report(current_user: dict = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """Return all active products that are at or below their low-stock threshold."""
    with transaction() as cursor:
        rows = cursor.execute(
            """
            SELECT id, name, quantity_in_stock, low_stock_threshold, unit_type
            FROM products
            WHERE is_active = 1 AND quantity_in_stock <= low_stock_threshold
            ORDER BY id
            """
        ).fetchall()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "quantity_in_stock": row["quantity_in_stock"],
            "low_stock_threshold": row["low_stock_threshold"],
            "unit_type": row["unit_type"],
        }
        for row in rows
    ]
