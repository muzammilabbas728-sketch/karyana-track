import os
import unittest
from pathlib import Path
from starlette.testclient import TestClient

TEST_DB = Path.cwd() / "test_third_party_loans_unit.db"

from app.database import get_connection, init_db, transaction
from app.main import app
from app.routers.auth import hash_pin

client = TestClient(app)


class TestThirdPartyLoans(unittest.TestCase):
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
        # Unauthenticated
        res = client.get("/cash/borrowers")
        self.assertIn(res.status_code, (401, 403, 422))

        # Staff cashier
        res_staff = client.get("/cash/borrowers", headers=self.staff_headers)
        self.assertEqual(res_staff.status_code, 403)

        # Owner
        res_owner = client.get("/cash/borrowers", headers=self.owner_headers)
        self.assertEqual(res_owner.status_code, 200)
        data = res_owner.json()
        self.assertEqual(data["total_lent"], 0.0)
        self.assertEqual(data["total_recovered"], 0.0)
        self.assertEqual(data["total_outstanding"], 0.0)

    def test_create_borrower(self):
        # Create new borrower
        res = client.post(
            "/cash/borrowers",
            json={"name": "Ali Ahmed", "phone": "03001234567", "notes": "Friend"},
            headers=self.owner_headers,
        )
        self.assertEqual(res.status_code, 201)
        b = res.json()
        self.assertEqual(b["name"], "Ali Ahmed")
        self.assertEqual(b["balance_owed"], 0.0)
        self.assertEqual(b["status"], "settled")

        # Duplicate name rejection
        dup = client.post(
            "/cash/borrowers",
            json={"name": "ali ahmed"},
            headers=self.owner_headers,
        )
        self.assertEqual(dup.status_code, 400)

    def test_give_loan_and_receive_repayment_flow(self):
        # 1. Create borrower
        res_b = client.post(
            "/cash/borrowers",
            json={"name": "Tariq Mahmood", "phone": "03129876543"},
            headers=self.owner_headers,
        )
        self.assertEqual(res_b.status_code, 201)
        b_id = res_b.json()["id"]

        # 2. Give Loan of Rs. 15,000
        res_loan = client.post(
            "/cash/borrowers/transactions",
            json={
                "borrower_id": b_id,
                "type": "loan_given",
                "amount": 15000.0,
                "notes": "Emergency loan for 1 month",
            },
            headers=self.owner_headers,
        )
        self.assertEqual(res_loan.status_code, 201)
        loan_tx = res_loan.json()
        self.assertEqual(loan_tx["amount"], 15000.0)
        self.assertEqual(loan_tx["type"], "loan_given")

        # Check borrower list & balance
        res_list = client.get("/cash/borrowers", headers=self.owner_headers)
        data = res_list.json()
        self.assertEqual(data["total_lent"], 15000.0)
        self.assertEqual(data["total_recovered"], 0.0)
        self.assertEqual(data["total_outstanding"], 15000.0)
        self.assertEqual(data["borrowers"][0]["balance_owed"], 15000.0)
        self.assertEqual(data["borrowers"][0]["status"], "active")

        # Check cash summary
        res_sum = client.get("/cash/summary", headers=self.owner_headers)
        sum_data = res_sum.json()
        self.assertEqual(sum_data["breakdown_out"]["loans_given"], 15000.0)
        self.assertEqual(sum_data["total_outstanding_third_party_loans"], 15000.0)
        self.assertEqual(sum_data["current_balance"], -15000.0)

        # 3. Receive Repayment of Rs. 6,000
        res_rep = client.post(
            "/cash/borrowers/transactions",
            json={
                "borrower_id": b_id,
                "type": "repayment",
                "amount": 6000.0,
                "notes": "First partial installment",
            },
            headers=self.owner_headers,
        )
        self.assertEqual(res_rep.status_code, 201)

        # Verify remaining balance = 9000
        res_list2 = client.get("/cash/borrowers", headers=self.owner_headers)
        data2 = res_list2.json()
        self.assertEqual(data2["total_lent"], 15000.0)
        self.assertEqual(data2["total_recovered"], 6000.0)
        self.assertEqual(data2["total_outstanding"], 9000.0)
        self.assertEqual(data2["borrowers"][0]["balance_owed"], 9000.0)

        # 4. Check history
        res_hist = client.get(f"/cash/borrowers/{b_id}/history", headers=self.owner_headers)
        self.assertEqual(res_hist.status_code, 200)
        history = res_hist.json()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["type"], "repayment")
        self.assertEqual(history[1]["type"], "loan_given")

    def test_inline_borrower_creation(self):
        # Create loan by giving new name directly without prior creation
        res = client.post(
            "/cash/borrowers/transactions",
            json={
                "borrower_name": "Hamza Rafiq",
                "phone": "03335554443",
                "type": "loan_given",
                "amount": 5000.0,
                "notes": "Inline created",
            },
            headers=self.owner_headers,
        )
        self.assertEqual(res.status_code, 201)
        tx = res.json()
        self.assertEqual(tx["borrower_name"], "Hamza Rafiq")

        # Verify borrower is now in directory
        res_list = client.get("/cash/borrowers", headers=self.owner_headers)
        names = [b["name"] for b in res_list.json()["borrowers"]]
        self.assertIn("Hamza Rafiq", names)

    def test_void_loan_transaction(self):
        # Create borrower and loan
        res_loan = client.post(
            "/cash/borrowers/transactions",
            json={
                "borrower_name": "Kashif Khan",
                "type": "loan_given",
                "amount": 8000.0,
            },
            headers=self.owner_headers,
        )
        tx_id = res_loan.json()["id"]

        # Void the loan transaction
        res_void = client.post(f"/cash/borrowers/transactions/{tx_id}/void", headers=self.owner_headers)
        self.assertEqual(res_void.status_code, 200)
        self.assertEqual(res_void.json()["status"], "voided")

        # Verify total outstanding is now 0
        res_list = client.get("/cash/borrowers", headers=self.owner_headers)
        self.assertEqual(res_list.json()["total_outstanding"], 0.0)


if __name__ == "__main__":
    unittest.main()
