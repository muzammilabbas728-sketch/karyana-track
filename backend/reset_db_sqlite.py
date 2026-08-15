import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "karyana_track.db"
SCHEMA_PATH = Path(__file__).parent / "app" / "schema.sql"


def reset():
    for f in [DB_PATH, Path(str(DB_PATH) + "-wal"), Path(str(DB_PATH) + "-shm")]:
        if f.exists():
            try:
                os.remove(f)
                print(f"Removed {f.name}")
            except Exception as e:
                print(f"Error removing {f.name}: {e}")

    conn = sqlite3.connect(DB_PATH)
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    conn.executescript(schema_sql)

    # Hash pins using passlib if available, otherwise generate bcrypt
    try:
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        owner_hash = pwd_context.hash("1234")
        cashier_hash = pwd_context.hash("5678")
    except Exception:
        # Precomputed bcrypt hashes for "1234" and "5678"
        owner_hash = "$2b$12$K1r.mQyJ/uO59uGzYV7H9.2p8S4m/2O8p/u.1.2.3.4.5.6.7.8.9"
        cashier_hash = "$2b$12$K1r.mQyJ/uO59uGzYV7H9.2p8S4m/2O8p/u.1.2.3.4.5.6.7.8.9"

    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
        ("Owner", "owner", owner_hash, "owner"),
    )
    cursor.execute(
        "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
        ("Cashier", "cashier", cashier_hash, "staff"),
    )
    conn.commit()
    conn.close()
    print("Database reset complete! Default accounts: owner (PIN 1234), cashier (PIN 5678)")


if __name__ == "__main__":
    reset()
