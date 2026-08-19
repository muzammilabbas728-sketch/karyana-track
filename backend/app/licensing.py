"""Machine fingerprinting and licensing logic."""

import hashlib
import platform
import subprocess
import uuid

from .database import get_connection

DEFAULT_SECRET = "CHANGE_THIS_SECRET_BEFORE_SELLING"


def get_device_fingerprint() -> str:
    """
    Generate a stable identifier using the motherboard/BIOS UUID (Windows),
    falling back to uuid.getnode() + platform.node() if unavailable.
    """
    try:
        result = subprocess.run(
            ["wmic", "csproduct", "get", "UUID"],
            capture_output=True, text=True, timeout=5, creationflags=subprocess.CREATE_NO_WINDOW
        )
        lines = [l.strip() for l in result.stdout.splitlines() if l.strip() and "UUID" not in l]
        raw_ident = lines[0] if lines else f"{uuid.getnode()}:{platform.node()}"
    except Exception:
        raw_ident = f"{uuid.getnode()}:{platform.node()}"

    digest = hashlib.sha256(raw_ident.encode("utf-8")).hexdigest().upper()
    first_16 = digest[:16]
    return "-".join(first_16[i : i + 4] for i in range(0, 16, 4))


def generate_license_key(
    fingerprint: str,
    secret: str = DEFAULT_SECRET,
) -> str:
    """
    Generate a deterministic license key from fingerprint and secret.

    Hash format: SHA-256(fingerprint + secret)
    Formatted as 4 chunks of 5 uppercase characters (first 20 chars).
    """
    raw_payload = f"{fingerprint}{secret}"
    digest = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest().upper()
    first_20 = digest[:20]
    return "-".join(first_20[i : i + 5] for i in range(0, 20, 5))


def verify_license() -> dict:
    """
    Verify if the current device is licensed.

    Checks the `license` table for a matching device_fingerprint.
    Returns:
        {
            "licensed": bool,
            "customer_name": str | None,
            "fingerprint": str
        }
    """
    fingerprint = get_device_fingerprint()
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT customer_name, license_key FROM license WHERE device_fingerprint = ?",
            (fingerprint,),
        ).fetchone()

        if row:
            return {
                "licensed": True,
                "customer_name": row["customer_name"],
                "fingerprint": fingerprint,
            }

        return {
            "licensed": False,
            "customer_name": None,
            "fingerprint": fingerprint,
        }
    finally:
        conn.close()
