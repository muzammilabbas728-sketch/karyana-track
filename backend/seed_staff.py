"""Seed the initial staff user into the database."""

from app.database import transaction
from app.routers.auth import hash_pin


def main() -> None:
    """Insert the default staff user and print the generated id."""
    with transaction() as cursor:
        existing = cursor.execute(
            "SELECT id FROM users WHERE username = ?",
            ("cashier",),
        ).fetchone()
        if existing is not None:
            print(existing["id"])
            return

        cursor.execute(
            "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
            ("Cashier", "cashier", hash_pin("5678"), "staff"),
        )
        print(cursor.lastrowid)


if __name__ == "__main__":
    main()
