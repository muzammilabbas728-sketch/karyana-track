"""Inventory purchase router for tracking inventory investments."""

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..database import transaction
from ..models import (
    PurchaseCreate,
    PurchaseItemResponse,
    PurchaseResponse,
    PurchaseSummaryResponse,
)
from .auth import require_role

router = APIRouter(prefix="/purchases", tags=["purchases"])


def _format_purchase(p_row: Any, items_rows: List[Any]) -> PurchaseResponse:
    items = [
        PurchaseItemResponse(
            product_id=row["product_id"],
            product_name=row["product_name"],
            quantity=row["quantity"],
            cost_price=float(row["cost_price"]),
            total_cost=float(row["total_cost"]),
        )
        for row in items_rows
    ]
    return PurchaseResponse(
        id=p_row["id"],
        user_id=p_row["user_id"],
        user_name=p_row["user_name"],
        supplier_id=p_row["supplier_id"] if "supplier_id" in p_row.keys() else None,
        supplier_name=p_row["supplier_name"],
        total_cost=float(p_row["total_cost"]),
        payment_status=p_row["payment_status"],
        amount_paid=float(p_row["amount_paid"]) if "amount_paid" in p_row.keys() and p_row["amount_paid"] is not None else 0.0,
        notes=p_row["notes"],
        status=p_row["status"],
        created_at=p_row["created_at"],
        items=items,
    )


@router.get("", response_model=PurchaseSummaryResponse)
def get_purchases(
    current_user: dict = Depends(require_role("owner")),
) -> PurchaseSummaryResponse:
    """Retrieve all inventory purchases and total inventory investment (owner only)."""
    with transaction() as cursor:
        p_rows = cursor.execute(
            """
            SELECT ip.id, ip.user_id, u.name AS user_name, ip.supplier_id, ip.supplier_name, ip.total_cost,
                   ip.payment_status, ip.amount_paid, ip.notes, ip.status, ip.created_at
            FROM inventory_purchases ip
            JOIN users u ON ip.user_id = u.id
            ORDER BY ip.id DESC
            """
        ).fetchall()

        total_investment_row = cursor.execute(
            "SELECT COALESCE(SUM(total_cost), 0) FROM inventory_purchases WHERE status = 'active'"
        ).fetchone()
        purchases_investment = float(total_investment_row[0]) if total_investment_row else 0.0

        products_rows = cursor.execute(
            """
            SELECT cost_price, quantity_in_stock, unit_type, units_per_pack
            FROM products
            WHERE is_active = 1
            """
        ).fetchall()

        total_product_investment = 0.0
        for p in products_rows:
            cost = float(p["cost_price"] or 0)
            qty = float(p["quantity_in_stock"] or 0)
            u_type = p["unit_type"]
            units_per_pack = float(p["units_per_pack"] or 1) if p["units_per_pack"] else 1.0

            if u_type == "piece":
                inv = cost * qty
            elif u_type == "weight":
                inv = cost * (qty / 1000.0)
            elif u_type == "pack":
                inv = cost * (qty / units_per_pack) if units_per_pack > 0 else cost * qty
            else:
                inv = cost * qty
            total_product_investment += inv

        total_inv = purchases_investment if purchases_investment > 0 else total_product_investment

        purchases: List[PurchaseResponse] = []
        for p_row in p_rows:
            items_rows = cursor.execute(
                """
                SELECT pi.product_id, p.name AS product_name, pi.quantity, pi.cost_price, pi.total_cost
                FROM purchase_items pi
                JOIN products p ON pi.product_id = p.id
                WHERE pi.purchase_id = ?
                """,
                (p_row["id"],),
            ).fetchall()
            purchases.append(_format_purchase(p_row, items_rows))

    return PurchaseSummaryResponse(
        total_investment=round(total_inv, 2),
        purchases=purchases,
    )


@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: PurchaseCreate,
    current_user: dict = Depends(require_role("owner")),
) -> PurchaseResponse:
    """Record a new inventory purchase, increasing product stock (owner only)."""
    now = datetime.utcnow()
    supplier_clean = payload.supplier_name.strip() if payload.supplier_name else None
    notes_clean = payload.notes.strip() if payload.notes else None
    supplier_id = payload.supplier_id

    with transaction() as cursor:
        # Resolve supplier profile
        if supplier_id:
            supp = cursor.execute("SELECT id, name FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
            if supp:
                supplier_clean = supp["name"]
        elif supplier_clean:
            supp = cursor.execute("SELECT id, name FROM suppliers WHERE name = ?", (supplier_clean,)).fetchone()
            if supp:
                supplier_id = supp["id"]
            else:
                cursor.execute("INSERT INTO suppliers (name) VALUES (?)", (supplier_clean,))
                supplier_id = cursor.lastrowid

        # Validate items and calculate totals
        total_purchase_cost = 0.0
        validated_items = []

        for item in payload.items:
            product = cursor.execute(
                "SELECT id, name, quantity_in_stock, cost_price, unit_type, units_per_pack FROM products WHERE id = ? AND is_active = 1",
                (item.product_id,),
            ).fetchone()

            if product is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product ID {item.product_id} not found",
                )

            line_cost = round(item.quantity * item.cost_price, 2)
            total_purchase_cost += line_cost
            
            u_type = product["unit_type"]
            u_pack = product["units_per_pack"] or 1
            if u_type == "weight":
                stock_increment = int(round(item.quantity * 1000))
            elif u_type == "pack":
                stock_increment = int(round(item.quantity * u_pack))
            else:
                stock_increment = int(round(item.quantity))

            validated_items.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "quantity": item.quantity,
                "cost_price": item.cost_price,
                "line_cost": line_cost,
                "current_stock": product["quantity_in_stock"],
                "stock_increment": stock_increment,
            })

        total_purchase_cost = round(total_purchase_cost, 2)

        # Validate payment status & amount_paid
        pay_status = payload.payment_status
        if pay_status == "paid":
            amount_paid = total_purchase_cost
        elif pay_status == "credit":
            amount_paid = 0.0
        elif pay_status == "partial":
            amount_paid = round(float(payload.amount_paid or 0), 2)
            if amount_paid <= 0 or amount_paid >= total_purchase_cost:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="For partial payments, amount paid must be greater than 0 and less than total purchase cost.",
                )
        else:
            pay_status = "paid"
            amount_paid = total_purchase_cost

        # Insert purchase header
        cursor.execute(
            """
            INSERT INTO inventory_purchases (user_id, supplier_id, supplier_name, total_cost, payment_status, amount_paid, notes, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """,
            (
                current_user["id"],
                supplier_id,
                supplier_clean,
                total_purchase_cost,
                pay_status,
                amount_paid,
                notes_clean,
                now,
            ),
        )
        purchase_id = cursor.lastrowid

        # Insert items, update stock, and record stock adjustment
        for v in validated_items:
            cursor.execute(
                """
                INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price, total_cost)
                VALUES (?, ?, ?, ?, ?)
                """,
                (purchase_id, v["product_id"], v["quantity"], v["cost_price"], v["line_cost"]),
            )

            new_stock = v["current_stock"] + v["stock_increment"]
            cursor.execute(
                "UPDATE products SET quantity_in_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?",
                (new_stock, v["cost_price"], now, v["product_id"]),
            )

            cursor.execute(
                """
                INSERT INTO stock_adjustments (product_id, user_id, change_amount, reason, created_at)
                VALUES (?, ?, ?, 'restock', ?)
                """,
                (v["product_id"], current_user["id"], v["stock_increment"], now),
            )

        # Retrieve created purchase record
        p_row = cursor.execute(
            """
            SELECT ip.id, ip.user_id, u.name AS user_name, ip.supplier_id, ip.supplier_name, ip.total_cost,
                   ip.payment_status, ip.amount_paid, ip.notes, ip.status, ip.created_at
            FROM inventory_purchases ip
            JOIN users u ON ip.user_id = u.id
            WHERE ip.id = ?
            """,
            (purchase_id,),
        ).fetchone()

        items_rows = cursor.execute(
            """
            SELECT pi.product_id, p.name AS product_name, pi.quantity, pi.cost_price, pi.total_cost
            FROM purchase_items pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.purchase_id = ?
            """,
            (purchase_id,),
        ).fetchall()

    if p_row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recorded purchase",
        )

    return _format_purchase(p_row, items_rows)


@router.post("/{purchase_id}/cancel", response_model=PurchaseResponse)
def cancel_purchase(
    purchase_id: int,
    current_user: dict = Depends(require_role("owner")),
) -> PurchaseResponse:
    """Cancel/void an inventory purchase and deduct the purchased stock (owner only)."""
    now = datetime.utcnow()
    with transaction() as cursor:
        p_row = cursor.execute(
            """
            SELECT ip.id, ip.user_id, u.name AS user_name, ip.supplier_id, ip.supplier_name, ip.total_cost,
                   ip.payment_status, ip.amount_paid, ip.notes, ip.status, ip.created_at
            FROM inventory_purchases ip
            JOIN users u ON ip.user_id = u.id
            WHERE ip.id = ?
            """,
            (purchase_id,),
        ).fetchone()

        if p_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase record not found")

        if p_row["status"] == "cancelled":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase is already cancelled")

        items_rows = cursor.execute(
            """
            SELECT pi.product_id, p.name AS product_name, pi.quantity, pi.cost_price, pi.total_cost
            FROM purchase_items pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.purchase_id = ?
            """,
            (purchase_id,),
        ).fetchall()

        # Revert product stock
        for item in items_rows:
            product = cursor.execute(
                "SELECT quantity_in_stock, unit_type, units_per_pack FROM products WHERE id = ?",
                (item["product_id"],),
            ).fetchone()

            if product:
                u_type = product["unit_type"]
                u_pack = product["units_per_pack"] or 1
                if u_type == "weight":
                    stock_qty = int(round(item["quantity"] * 1000))
                elif u_type == "pack":
                    stock_qty = int(round(item["quantity"] * u_pack))
                else:
                    stock_qty = int(round(item["quantity"]))

                new_stock = max(0, product["quantity_in_stock"] - stock_qty)
                cursor.execute(
                    "UPDATE products SET quantity_in_stock = ?, updated_at = ? WHERE id = ?",
                    (new_stock, now, item["product_id"]),
                )
                cursor.execute(
                    """
                    INSERT INTO stock_adjustments (product_id, user_id, change_amount, reason, created_at)
                    VALUES (?, ?, ?, 'correction', ?)
                    """,
                    (item["product_id"], current_user["id"], -stock_qty, now),
                )

        cursor.execute(
            "UPDATE inventory_purchases SET status = 'cancelled' WHERE id = ?",
            (purchase_id,),
        )

        updated_p_row = cursor.execute(
            """
            SELECT ip.id, ip.user_id, u.name AS user_name, ip.supplier_id, ip.supplier_name, ip.total_cost,
                   ip.payment_status, ip.amount_paid, ip.notes, ip.status, ip.created_at
            FROM inventory_purchases ip
            JOIN users u ON ip.user_id = u.id
            WHERE ip.id = ?
            """,
            (purchase_id,),
        ).fetchone()

    return _format_purchase(updated_p_row, items_rows)


@router.put("/{purchase_id}", response_model=PurchaseResponse)
def update_purchase(
    purchase_id: int,
    payload: PurchaseCreate,
    current_user: dict = Depends(require_role("owner")),
) -> PurchaseResponse:
    """Update an existing inventory purchase, adjusting stock levels accordingly (owner only)."""
    now = datetime.utcnow()
    supplier_clean = payload.supplier_name.strip() if payload.supplier_name else None
    notes_clean = payload.notes.strip() if payload.notes else None
    supplier_id = payload.supplier_id

    with transaction() as cursor:
        p_row = cursor.execute(
            """
            SELECT ip.id, ip.status, ip.payment_status
            FROM inventory_purchases ip
            WHERE ip.id = ?
            """,
            (purchase_id,),
        ).fetchone()

        if p_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase record not found")

        if p_row["status"] == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot edit a cancelled purchase record",
            )

        # Resolve supplier profile
        if supplier_id:
            supp = cursor.execute("SELECT id, name FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
            if supp:
                supplier_clean = supp["name"]
        elif supplier_clean:
            supp = cursor.execute("SELECT id, name FROM suppliers WHERE name = ?", (supplier_clean,)).fetchone()
            if supp:
                supplier_id = supp["id"]
            else:
                cursor.execute("INSERT INTO suppliers (name) VALUES (?)", (supplier_clean,))
                supplier_id = cursor.lastrowid

        # 1. Fetch old purchase items and revert their stock impact
        old_items_rows = cursor.execute(
            "SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?",
            (purchase_id,),
        ).fetchall()

        for old_item in old_items_rows:
            product = cursor.execute(
                "SELECT quantity_in_stock, unit_type, units_per_pack FROM products WHERE id = ?",
                (old_item["product_id"],),
            ).fetchone()
            if product:
                u_type = product["unit_type"]
                u_pack = product["units_per_pack"] or 1
                if u_type == "weight":
                    reverted_qty = int(round(old_item["quantity"] * 1000))
                elif u_type == "pack":
                    reverted_qty = int(round(old_item["quantity"] * u_pack))
                else:
                    reverted_qty = int(round(old_item["quantity"]))

                reverted_stock = max(0, product["quantity_in_stock"] - reverted_qty)
                cursor.execute(
                    "UPDATE products SET quantity_in_stock = ?, updated_at = ? WHERE id = ?",
                    (reverted_stock, now, old_item["product_id"]),
                )

        # Delete old purchase items
        cursor.execute("DELETE FROM purchase_items WHERE purchase_id = ?", (purchase_id,))

        # 2. Validate new items and calculate totals
        total_purchase_cost = 0.0
        validated_items = []

        for item in payload.items:
            product = cursor.execute(
                "SELECT id, name, quantity_in_stock, cost_price, unit_type, units_per_pack FROM products WHERE id = ? AND is_active = 1",
                (item.product_id,),
            ).fetchone()

            if product is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product ID {item.product_id} not found",
                )

            line_cost = round(item.quantity * item.cost_price, 2)
            total_purchase_cost += line_cost

            u_type = product["unit_type"]
            u_pack = product["units_per_pack"] or 1
            if u_type == "weight":
                stock_increment = int(round(item.quantity * 1000))
            elif u_type == "pack":
                stock_increment = int(round(item.quantity * u_pack))
            else:
                stock_increment = int(round(item.quantity))

            validated_items.append({
                "product_id": item.product_id,
                "product_name": product["name"],
                "quantity": item.quantity,
                "cost_price": item.cost_price,
                "line_cost": line_cost,
                "current_stock": product["quantity_in_stock"],
                "stock_increment": stock_increment,
            })

        total_purchase_cost = round(total_purchase_cost, 2)

        # Validate payment status & amount_paid
        pay_status = payload.payment_status
        if pay_status == "paid":
            amount_paid = total_purchase_cost
        elif pay_status == "credit":
            amount_paid = 0.0
        elif pay_status == "partial":
            amount_paid = round(float(payload.amount_paid or 0), 2)
            if amount_paid <= 0 or amount_paid >= total_purchase_cost:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="For partial payments, amount paid must be greater than 0 and less than total purchase cost.",
                )
        else:
            pay_status = "paid"
            amount_paid = total_purchase_cost

        # 3. Update purchase header
        cursor.execute(
            """
            UPDATE inventory_purchases
            SET supplier_id = ?, supplier_name = ?, total_cost = ?, payment_status = ?, amount_paid = ?, notes = ?
            WHERE id = ?
            """,
            (
                supplier_id,
                supplier_clean,
                total_purchase_cost,
                pay_status,
                amount_paid,
                notes_clean,
                purchase_id,
            ),
        )

        # 4. Insert updated items and apply new stock additions
        for v in validated_items:
            cursor.execute(
                """
                INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price, total_cost)
                VALUES (?, ?, ?, ?, ?)
                """,
                (purchase_id, v["product_id"], v["quantity"], v["cost_price"], v["line_cost"]),
            )

            new_stock = v["current_stock"] + v["stock_increment"]
            cursor.execute(
                "UPDATE products SET quantity_in_stock = ?, cost_price = ?, updated_at = ? WHERE id = ?",
                (new_stock, v["cost_price"], now, v["product_id"]),
            )

            cursor.execute(
                """
                INSERT INTO stock_adjustments (product_id, user_id, change_amount, reason, created_at)
                VALUES (?, ?, ?, 'correction', ?)
                """,
                (v["product_id"], current_user["id"], v["stock_increment"], now),
            )

        # Fetch updated record
        updated_p_row = cursor.execute(
            """
            SELECT ip.id, ip.user_id, u.name AS user_name, ip.supplier_id, ip.supplier_name, ip.total_cost,
                   ip.payment_status, ip.amount_paid, ip.notes, ip.status, ip.created_at
            FROM inventory_purchases ip
            JOIN users u ON ip.user_id = u.id
            WHERE ip.id = ?
            """,
            (purchase_id,),
        ).fetchone()

        items_rows = cursor.execute(
            """
            SELECT pi.product_id, p.name AS product_name, pi.quantity, pi.cost_price, pi.total_cost
            FROM purchase_items pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.purchase_id = ?
            """,
            (purchase_id,),
        ).fetchall()

    return _format_purchase(updated_p_row, items_rows)
