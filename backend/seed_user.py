"""Seed the initial owner user into the database."""

from app.routers.auth import hash_pin
from app.database import transaction


def main() -> None:
    """Insert the default owner user and print the generated id."""
    with transaction() as cursor:
        existing = cursor.execute(
            "SELECT id FROM users WHERE username = ?",
            ("owner",),
        ).fetchone()
        if existing is not None:
            print(existing["id"])
            return

        cursor.execute(
            "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
            ("Owner", "owner", hash_pin("1234"), "owner"),
        )
        print(cursor.lastrowid)


if __name__ == "__main__":
    main()
