import os
import unittest
from pathlib import Path
from starlette.testclient import TestClient

TEST_DB = Path.cwd() / "test_cash_unit.db"
os.environ["DATABASE_PATH"] = str(TEST_DB)

from app.database import get_connection, init_db, transaction
from app.main import app
from app.routers.auth import hash_pin

client = TestClient(app)


class TestCashManagement(unittest.TestCase):
    def setUp(self):
        os.environ["DATABASE_PATH"] = str(TEST_DB)
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass
        init_db(str(TEST_DB))

        # Create owner and staff users
        with transaction(str(TEST_DB)) as cursor:
            cursor.execute(
                "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
                ("Store Owner", "owner1", hash_pin("1111"), "owner"),
            )
            self.owner_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
                ("Staff Cashier", "staff1", hash_pin("2222"), "staff"),
            )
            self.staff_id = cursor.lastrowid

            # Create test customer
            cursor.execute(
                "INSERT INTO customers (name, phone, credit_limit) VALUES (?, ?, ?)",
                ("John Doe", "03001234567", 10000.0),
            )
            self.customer_id = cursor.lastrowid

            # Create test supplier
            cursor.execute(
                "INSERT INTO suppliers (name, phone) VALUES (?, ?)",
                ("Metro Wholesale", "03009876543"),
            )
            self.supplier_id = cursor.lastrowid

            # Create product
            cursor.execute(
                "INSERT INTO products (name, cost_price, selling_price, quantity_in_stock, low_stock_threshold) "
                "VALUES (?, ?, ?, ?, ?)",
                ("Cooking Oil 1L", 400.0, 500.0, 100, 10),
            )
            self.product_id = cursor.lastrowid

        # Login
        resp_owner = client.post("/auth/login", json={"username": "owner1", "pin": "1111"})
        self.assertEqual(resp_owner.status_code, 200)
        self.owner_token = resp_owner.json()["token"]
        self.owner_headers = {"Authorization": f"Bearer {self.owner_token}"}

        resp_staff = client.post("/auth/login", json={"username": "staff1", "pin": "2222"})
        self.assertEqual(resp_staff.status_code, 200)
        self.staff_token = resp_staff.json()["token"]
        self.staff_headers = {"Authorization": f"Bearer {self.staff_token}"}

    def tearDown(self):
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass

    def test_permissions(self):
        # Unauthenticated (FastAPI returns 422 for missing required header or 401)
        res = client.get("/cash/summary")
        self.assertIn(res.status_code, (401, 403, 422))

        # Staff
        res_staff = client.get("/cash/summary", headers=self.staff_headers)
        self.assertEqual(res_staff.status_code, 403)

        # Owner
        res_owner = client.get("/cash/summary", headers=self.owner_headers)
        self.assertEqual(res_owner.status_code, 200)
        data = res_owner.json()
        self.assertEqual(data["current_balance"], 0.0)

    def test_cash_sales_vs_credit_sales_and_customer_payments(self):
        # 1. Cash sale: 2 units @ Rs. 500 = Rs. 1000
        res_cash_sale = client.post(
            "/sales",
            headers=self.owner_headers,
            json={
                "items": [{"product_id": self.product_id, "quantity": 2, "sell_as_pack": False}],
                "payment_status": "paid",
            },
        )
        self.assertEqual(res_cash_sale.status_code, 201)

        summary = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary["breakdown_in"]["sales_cash"], 1000.0)
        self.assertEqual(summary["breakdown_in"]["customer_payments"], 0.0)
        self.assertEqual(summary["current_balance"], 1000.0)

        # 2. Credit sale: 3 units @ Rs. 500 = Rs. 1500
        # MUST NOT increase cash balance
        res_credit_sale = client.post(
            "/sales",
            headers=self.owner_headers,
            json={
                "items": [{"product_id": self.product_id, "quantity": 3, "sell_as_pack": False}],
                "payment_status": "credit",
                "customer_id": self.customer_id,
            },
        )
        self.assertEqual(res_credit_sale.status_code, 201)

        summary2 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary2["breakdown_in"]["sales_cash"], 1000.0)
        self.assertEqual(summary2["breakdown_in"]["customer_payments"], 0.0)
        self.assertEqual(summary2["current_balance"], 1000.0)  # Unchanged!

        # 3. Customer later pays Rs. 800 towards their credit balance
        res_cust_pay = client.post(
            f"/customers/{self.customer_id}/payments",
            headers=self.owner_headers,
            json={"amount": 800.0},
        )
        self.assertEqual(res_cust_pay.status_code, 201)

        summary3 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary3["breakdown_in"]["sales_cash"], 1000.0)
        self.assertEqual(summary3["breakdown_in"]["customer_payments"], 800.0)
        self.assertEqual(summary3["total_money_in"], 1800.0)
        self.assertEqual(summary3["current_balance"], 1800.0)

    def test_non_trading_cash_transactions_and_voiding(self):
        # 1. Owner Investment: Rs. 50,000
        inv_res = client.post(
            "/cash/transactions",
            headers=self.owner_headers,
            json={"type": "owner_investment", "amount": 50000.0, "description": "Shop opening capital"},
        )
        self.assertEqual(inv_res.status_code, 201)

        # 2. Owner Withdrawal: Rs. 10,000
        with_res = client.post(
            "/cash/transactions",
            headers=self.owner_headers,
            json={"type": "owner_withdrawal", "amount": 10000.0, "description": "Personal use"},
        )
        self.assertEqual(with_res.status_code, 201)
        withdrawal_id = with_res.json()["id"]

        # 3. Loan Given: Rs. 5,000
        loan_g_res = client.post(
            "/cash/transactions",
            headers=self.owner_headers,
            json={"type": "loan_given", "amount": 5000.0, "description": "Loan to Brother"},
        )
        self.assertEqual(loan_g_res.status_code, 201)

        # 4. Loan Repayment: Rs. 2,000
        loan_r_res = client.post(
            "/cash/transactions",
            headers=self.owner_headers,
            json={"type": "loan_repayment", "amount": 2000.0, "description": "Repayment from Brother"},
        )
        self.assertEqual(loan_r_res.status_code, 201)

        # 5. Other Expense: Rs. 3,000 (Electricity bill)
        exp_res = client.post(
            "/cash/transactions",
            headers=self.owner_headers,
            json={"type": "other_expense", "amount": 3000.0, "description": "Electricity Bill"},
        )
        self.assertEqual(exp_res.status_code, 201)

        # 6. Other Income: Rs. 1,000 (Scrap carton sales)
        inc_res = client.post(
            "/cash/transactions",
            headers=self.owner_headers,
            json={"type": "other_income", "amount": 1000.0, "description": "Sold empty cartons"},
        )
        self.assertEqual(inc_res.status_code, 201)

        # Total Money In: 50,000 (inv) + 2,000 (loan rep) + 1,000 (other in) = 53,000
        # Total Money Out: 10,000 (with) + 5,000 (loan giv) + 3,000 (other exp) = 18,000
        # Balance = 53,000 - 18,000 = 35,000
        summary = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary["total_money_in"], 53000.0)
        self.assertEqual(summary["total_money_out"], 18000.0)
        self.assertEqual(summary["current_balance"], 35000.0)

        # 7. Void Owner Withdrawal -> Out should decrease by 10,000, balance becomes 45,000
        void_res = client.post(f"/cash/transactions/{withdrawal_id}/void", headers=self.owner_headers)
        self.assertEqual(void_res.status_code, 200)
        self.assertEqual(void_res.json()["status"], "voided")

        summary_after_void = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary_after_void["total_money_out"], 8000.0)
        self.assertEqual(summary_after_void["current_balance"], 45000.0)

        # 8. Verify existing daily reports & profit are NOT affected by owner withdrawals or expenses
        daily = client.get("/reports/daily", headers=self.owner_headers).json()
        self.assertEqual(daily["total_sales_count"], 0)
        self.assertEqual(daily["total_revenue"], 0.0)
        self.assertEqual(daily["total_profit"], 0.0)


if __name__ == "__main__":
    unittest.main()
