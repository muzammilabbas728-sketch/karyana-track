"""Reset database to fresh initial state with default owner and cashier accounts."""

import os
from pathlib import Path
from app.database import DB_PATH, init_db
import seed_user
import seed_staff


def reset_database() -> None:
    db_file = Path(DB_PATH)
    wal_file = Path(str(DB_PATH) + "-wal")
    shm_file = Path(str(DB_PATH) + "-shm")

    for f in [db_file, wal_file, shm_file]:
        if f.exists():
            try:
                os.remove(f)
                print(f"Removed existing database file: {f.name}")
            except Exception as e:
                print(f"Could not remove {f.name}: {e}")

    print("Re-initializing schema...")
    init_db()

    print("Seeding owner user...")
    seed_user.main()

    print("Seeding cashier user...")
    seed_staff.main()

    print("Database successfully reset!")


if __name__ == "__main__":
    reset_database()
