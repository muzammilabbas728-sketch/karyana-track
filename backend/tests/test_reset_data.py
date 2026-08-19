import os
import unittest
from pathlib import Path
from starlette.testclient import TestClient

# Use a test database
TEST_DB = Path(__file__).parent / "test_karyana.db"
os.environ["DATABASE_PATH"] = str(TEST_DB)

from app.database import init_db, transaction, get_connection
from app.main import app
from app.routers.auth import hash_pin

client = TestClient(app)


class TestResetData(unittest.TestCase):
    def setUp(self):
        os.environ["DATABASE_PATH"] = str(TEST_DB)
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass
        init_db(str(TEST_DB))

        # Create an owner and a staff user
        with transaction(str(TEST_DB)) as cursor:
            cursor.execute(
                "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
                ("Owner User", "owner1", hash_pin("1234"), "owner"),
            )
            self.owner_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
                ("Staff User", "staff1", hash_pin("1234"), "staff"),
            )
            self.staff_id = cursor.lastrowid

            # Insert dummy product & sale
            cursor.execute(
                "INSERT INTO products (name, cost_price, selling_price, quantity_in_stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?)",
                ("Test Milk", 80.0, 100.0, 50, 5),
            )
            self.product_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO sales (user_id, total_amount, total_profit, payment_status) VALUES (?, ?, ?, ?)",
                (self.staff_id, 100.0, 20.0, "paid"),
            )
            self.sale_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)",
                (self.sale_id, self.product_id, 1, 100.0, 80.0),
            )

        # Login as owner & staff to get tokens
        resp_owner = client.post("/auth/login", json={"username": "owner1", "pin": "1234"})
        self.assertEqual(resp_owner.status_code, 200)
        self.owner_token = resp_owner.json()["token"]

        resp_staff = client.post("/auth/login", json={"username": "staff1", "pin": "1234"})
        self.assertEqual(resp_staff.status_code, 200)
        self.staff_token = resp_staff.json()["token"]

    def tearDown(self):
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass

    def test_staff_cannot_reset_data(self):
        resp = client.post(
            "/admin/reset-data",
            headers={"Authorization": f"Bearer {self.staff_token}"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_owner_can_reset_data(self):
        resp = client.post(
            "/admin/reset-data",
            headers={"Authorization": f"Bearer {self.owner_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("All business data has been reset", resp.json()["detail"])

        # Check database content: products, sales, sale_items should be 0, users should remain 2
        conn = get_connection(str(TEST_DB))
        c = conn.cursor()

        self.assertEqual(c.execute("SELECT COUNT(*) FROM products").fetchone()[0], 0)
        self.assertEqual(c.execute("SELECT COUNT(*) FROM sales").fetchone()[0], 0)
        self.assertEqual(c.execute("SELECT COUNT(*) FROM sale_items").fetchone()[0], 0)
        self.assertEqual(c.execute("SELECT COUNT(*) FROM users").fetchone()[0], 2)
        conn.close()


if __name__ == "__main__":
    unittest.main()
