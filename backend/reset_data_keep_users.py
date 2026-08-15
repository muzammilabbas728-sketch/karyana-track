import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "karyana_track.db"


def reset_transactional_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    tables_to_clear = [
        "sale_items",
        "sales",
        "purchase_items",
        "inventory_purchases",
        "stock_adjustments",
        "products",
        "customer_payments",
        "customers",
        "investments",
        "sessions",
    ]

    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"Cleared table: {table}")
        except Exception as e:
            print(f"Could not clear {table}: {e}")

    # Reset autoincrement counters for cleared tables
    for table in tables_to_clear:
        try:
            cursor.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))
        except Exception:
            pass

    conn.commit()

    # Check preserved users
    users = cursor.execute("SELECT id, name, username, role FROM users").fetchall()
    print(f"\nPreserved {len(users)} user account(s):")
    for u in users:
        print(f" - ID {u[0]}: {u[1]} (@{u[2]}, role: {u[3]})")

    conn.close()
    print("\nBusiness data reset complete. All user accounts remain intact!")


if __name__ == "__main__":
    reset_transactional_data()
