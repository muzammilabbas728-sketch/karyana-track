"""Admin endpoints for system management."""

import os
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from ..database import DB_PATH, get_db_path, transaction
from .auth import require_role

router = APIRouter(tags=["admin"])

SQLITE_HEADER = b"SQLite format 3\x00"


@router.get("/admin/backup")
def download_backup(current_user: dict = Depends(require_role("owner"))):
    """Download a copy of the SQLite database file. Owner only."""
    db_file_path = Path(get_db_path())
    if not db_file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database file not found.",
        )

    today_str = date.today().isoformat()
    filename = f"karyana_track_backup_{today_str}.db"

    return FileResponse(
        path=str(db_file_path),
        media_type="application/octet-stream",
        filename=filename,
    )


@router.post("/admin/restore")
async def restore_backup(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("owner")),
) -> dict:
    """Restore the database from an uploaded SQLite backup file. Owner only."""
    # Read first 16 bytes to validate SQLite header
    header = await file.read(16)
    if header != SQLITE_HEADER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid backup file: Not a valid SQLite 3 database.",
        )

    db_file_path = Path(get_db_path())
    new_path = Path(str(db_file_path) + ".new")

    try:
        with open(new_path, "wb") as f:
            f.write(header)
            while chunk := await file.read(1024 * 64):
                f.write(chunk)

        # Atomically replace current database file
        os.replace(new_path, db_file_path)
    except Exception as exc:
        if new_path.exists():
            try:
                new_path.unlink()
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore database: {str(exc)}",
        )

    return {
        "detail": "Database restored successfully. Please restart the server manually for the restore to take effect."
    }


@router.post("/admin/reset-data")
def reset_data(current_user: dict = Depends(require_role("owner"))) -> dict:
    """Delete all business data (products, sales, customers, suppliers, purchases, etc.) but keep users. Owner only."""
    tables = [
        "sale_items",
        "sales",
        "stock_adjustments",
        "customer_payments",
        "customers",
        "purchase_items",
        "inventory_purchases",
        "supplier_payments",
        "suppliers",
        "investments",
        "products",
    ]
    with transaction() as cursor:
        for table in tables:
            cursor.execute(f"DELETE FROM {table}")
            try:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))
            except Exception:
                pass
    return {"detail": "All business data has been reset. User accounts were preserved."}
