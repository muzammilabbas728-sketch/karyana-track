"""License endpoints for machine activation and verification."""

from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..database import transaction
from ..licensing import generate_license_key, get_device_fingerprint, verify_license

router = APIRouter(prefix="/license", tags=["license"])


class ActivateRequest(BaseModel):
    license_key: str
    customer_name: Optional[str] = ""


@router.get("")
@router.get("/")
def get_license_status() -> dict:
    """
    Get current device license status.
    No authentication required.
    """
    return verify_license()


@router.post("/activate")
def activate_license(body: ActivateRequest) -> dict:
    """
    Activate the application on the current machine with a license key.
    No authentication required.
    """
    fingerprint = get_device_fingerprint()
    customer_name = (body.customer_name or "").strip()
    expected_key = generate_license_key(fingerprint=fingerprint)

    provided_key = body.license_key.strip().upper()

    if provided_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid license key",
        )

    with transaction() as cursor:
        cursor.execute(
            """
            INSERT INTO license (customer_name, device_fingerprint, license_key)
            VALUES (?, ?, ?)
            ON CONFLICT(device_fingerprint) DO UPDATE SET
                customer_name = excluded.customer_name,
                license_key = excluded.license_key
            """,
            (customer_name, fingerprint, expected_key),
        )

    return {"activated": True}
