"""Product routes for managing inventory items."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status

from .auth import get_current_user, require_role
from ..database import transaction
from ..models import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    StockAdjustmentHistoryItem,
    StockAdjustmentRequest,
)

router = APIRouter(prefix="/products", tags=["products"])


def _row_to_product(row: Any) -> ProductResponse:
    """Convert a sqlite3.Row into a ProductResponse model."""
    return ProductResponse.model_validate(dict(row))


@router.get("", response_model=List[ProductResponse])
def list_products(current_user: dict = Depends(get_current_user)) -> List[ProductResponse]:
    """Return all active products available in inventory."""
    with transaction() as cursor:
        rows = cursor.execute(
            "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
            "low_stock_threshold, is_active, created_at, updated_at "
            "FROM products WHERE is_active = 1 ORDER BY id"
        ).fetchall()

    return [_row_to_product(row) for row in rows]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, current_user: dict = Depends(get_current_user)) -> ProductResponse:
    """Retrieve a single active product by its identifier."""
    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
            "low_stock_threshold, is_active, created_at, updated_at "
            "FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()

    if row is None or row["is_active"] != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return _row_to_product(row)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, current_user: dict = Depends(require_role("owner"))) -> ProductResponse:
    """Create a new product and return the stored record."""
    now = datetime.utcnow()
    with transaction() as cursor:
        cursor.execute(
            """
            INSERT INTO products (
                name, barcode, cost_price, selling_price, quantity_in_stock, unit_type,
                units_per_pack, low_stock_threshold, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                product.name,
                product.barcode,
                product.cost_price,
                product.selling_price,
                product.quantity_in_stock,
                product.unit_type,
                product.units_per_pack,
                product.low_stock_threshold,
                now,
                now,
            ),
        )
        product_id = cursor.lastrowid

    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
            "low_stock_threshold, is_active, created_at, updated_at "
            "FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return _row_to_product(row)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product_update: ProductUpdate, current_user: dict = Depends(require_role("owner"))) -> ProductResponse:
    """Partially update an existing product and return the latest state."""
    now = datetime.utcnow()
    updates: Dict[str, Any] = {}
    if product_update.name is not None:
        updates["name"] = product_update.name
    if product_update.barcode is not None:
        updates["barcode"] = product_update.barcode
    if product_update.cost_price is not None:
        updates["cost_price"] = product_update.cost_price
    if product_update.selling_price is not None:
        updates["selling_price"] = product_update.selling_price
    if product_update.quantity_in_stock is not None:
        updates["quantity_in_stock"] = product_update.quantity_in_stock
    if product_update.unit_type is not None:
        updates["unit_type"] = product_update.unit_type
    if product_update.units_per_pack is not None:
        updates["units_per_pack"] = product_update.units_per_pack
    if product_update.low_stock_threshold is not None:
        updates["low_stock_threshold"] = product_update.low_stock_threshold

    if not updates:
        with transaction() as cursor:
            existing = cursor.execute(
                "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
                "low_stock_threshold, is_active, created_at, updated_at "
                "FROM products WHERE id = ?",
                (product_id,),
            ).fetchone()
        if existing is None or existing["is_active"] != 1:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return _row_to_product(existing)

    set_clause = ", ".join(f"{field} = ?" for field in updates.keys())
    values = list(updates.values()) + [now, product_id]

    with transaction() as cursor:
        cursor.execute(
            f"UPDATE products SET {set_clause}, updated_at = ? WHERE id = ? AND is_active = 1",
            values,
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    with transaction() as cursor:
        row = cursor.execute(
            "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
            "low_stock_threshold, is_active, created_at, updated_at "
            "FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()

    if row is None or row["is_active"] != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return _row_to_product(row)


@router.post("/{product_id}/adjust-stock", response_model=ProductResponse)
def adjust_product_stock(
    product_id: int,
    adjustment: StockAdjustmentRequest,
    current_user: dict = Depends(get_current_user),
) -> ProductResponse:
    """Adjust the stock level for a product and record the stock adjustment."""
    if adjustment.reason == "correction" and current_user["role"] != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can perform corrections",
        )

    now = datetime.utcnow()
    with transaction() as cursor:
        product = cursor.execute(
            "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
            "low_stock_threshold, is_active, created_at, updated_at "
            "FROM products WHERE id = ? AND is_active = 1",
            (product_id,),
        ).fetchone()

        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        new_quantity = product["quantity_in_stock"] + adjustment.change_amount
        if new_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Adjustment would result in negative stock",
            )

        cursor.execute(
            "INSERT INTO stock_adjustments (product_id, user_id, change_amount, reason, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                product_id,
                current_user["id"],
                adjustment.change_amount,
                adjustment.reason,
                now,
            ),
        )

        cursor.execute(
            "UPDATE products SET quantity_in_stock = ?, updated_at = ? WHERE id = ?",
            (new_quantity, now, product_id),
        )

        updated_product = cursor.execute(
            "SELECT id, name, barcode, cost_price, selling_price, quantity_in_stock, unit_type, units_per_pack, "
            "low_stock_threshold, is_active, created_at, updated_at "
            "FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()

    if updated_product is None or updated_product["is_active"] != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return _row_to_product(updated_product)


@router.get("/{product_id}/stock-history", response_model=List[StockAdjustmentHistoryItem])
def get_product_stock_history(
    product_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> List[StockAdjustmentHistoryItem]:
    """Return the adjustment history for a product, including the adjusting user's name."""
    with transaction() as cursor:
        rows = cursor.execute(
            "SELECT sa.id, sa.change_amount, sa.reason, u.name AS user_name, sa.created_at "
            "FROM stock_adjustments sa "
            "JOIN users u ON sa.user_id = u.id "
            "WHERE sa.product_id = ? "
            "ORDER BY sa.created_at DESC",
            (product_id,),
        ).fetchall()

    return [StockAdjustmentHistoryItem.model_validate(dict(row)) for row in rows]


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, current_user: dict = Depends(require_role("owner"))) -> Response:
    """Soft-delete a product by marking it inactive."""
    with transaction() as cursor:
        cursor.execute("UPDATE products SET is_active = 0, updated_at = ? WHERE id = ? AND is_active = 1", (datetime.utcnow(), product_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
