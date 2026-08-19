import os
import unittest
from pathlib import Path
from starlette.testclient import TestClient

TEST_DB = Path.cwd() / "test_bank_loans_unit.db"

from app.database import get_connection, init_db, transaction
from app.main import app
from app.routers.auth import hash_pin

client = TestClient(app)


class TestBankLoanManagement(unittest.TestCase):
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
        res = client.get("/cash/bank-loans")
        self.assertIn(res.status_code, (401, 403, 422))

        # Staff cashier
        res_staff = client.get("/cash/bank-loans", headers=self.staff_headers)
        self.assertEqual(res_staff.status_code, 403)

        # Owner
        res_owner = client.get("/cash/bank-loans", headers=self.owner_headers)
        self.assertEqual(res_owner.status_code, 200)
        data = res_owner.json()
        self.assertEqual(data["total_borrowed"], 0.0)
        self.assertEqual(data["total_outstanding"], 0.0)

    def test_bank_loan_flow_and_invariance(self):
        # Initial cash balance is 0
        summary0 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary0["current_balance"], 0.0)
        self.assertEqual(summary0["total_outstanding_bank_loans"], 0.0)

        # 1. Borrow Rs. 500,000 from Bank Alfalah
        res_loan = client.post(
            "/cash/bank-loans",
            headers=self.owner_headers,
            json={
                "bank_name": "Bank Alfalah",
                "loan_amount": 500000.0,
                "reference_number": "BA-LN-8899",
                "description": "Store expansion loan",
            },
        )
        self.assertEqual(res_loan.status_code, 201)
        loan_data = res_loan.json()
        loan_id = loan_data["id"]
        self.assertEqual(loan_data["bank_name"], "Bank Alfalah")
        self.assertEqual(loan_data["loan_amount"], 500000.0)
        self.assertEqual(loan_data["remaining_balance"], 500000.0)

        # Verify Business Cash & Outstanding Bank Loans
        summary1 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary1["current_balance"], 500000.0)
        self.assertEqual(summary1["total_money_in"], 500000.0)
        self.assertEqual(summary1["breakdown_in"]["bank_loans_received"], 500000.0)
        self.assertEqual(summary1["total_outstanding_bank_loans"], 500000.0)

        # Verify Total Sales and Profit are 0 (invariance guarantee)
        daily_rep = client.get("/reports/daily", headers=self.owner_headers).json()
        self.assertEqual(daily_rep["total_sales_count"], 0)
        self.assertEqual(daily_rep["total_revenue"], 0.0)
        self.assertEqual(daily_rep["total_profit"], 0.0)

        # 2. Record Repayment: Principal = Rs. 100,000, Interest = Rs. 10,000
        # Total Cash Disbursed = Rs. 110,000
        res_rep = client.post(
            f"/cash/bank-loans/{loan_id}/repayments",
            headers=self.owner_headers,
            json={
                "principal_amount": 100000.0,
                "interest_amount": 10000.0,
                "description": "1st Installment",
            },
        )
        self.assertEqual(res_rep.status_code, 201)
        rep_data = res_rep.json()
        repayment_id = rep_data["id"]
        self.assertEqual(rep_data["principal_amount"], 100000.0)
        self.assertEqual(rep_data["interest_amount"], 10000.0)
        self.assertEqual(rep_data["total_payment"], 110000.0)

        # Verify Business Cash: 500,000 - 110,000 = 390,000
        # Outstanding Loan: 500,000 - 100,000 = 400,000
        summary2 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary2["current_balance"], 390000.0)
        self.assertEqual(summary2["total_money_out"], 110000.0)
        self.assertEqual(summary2["breakdown_out"]["bank_loan_principal"], 100000.0)
        self.assertEqual(summary2["breakdown_out"]["bank_loan_interest"], 10000.0)
        self.assertEqual(summary2["total_outstanding_bank_loans"], 400000.0)

        # Verify Bank Loans overview endpoint
        overview = client.get("/cash/bank-loans", headers=self.owner_headers).json()
        self.assertEqual(overview["total_borrowed"], 500000.0)
        self.assertEqual(overview["total_principal_repaid"], 100000.0)
        self.assertEqual(overview["total_interest_paid"], 10000.0)
        self.assertEqual(overview["total_outstanding"], 400000.0)
        self.assertEqual(overview["loans"][0]["remaining_balance"], 400000.0)

        # 3. Cannot repay more principal than remaining balance
        res_overflow = client.post(
            f"/cash/bank-loans/{loan_id}/repayments",
            headers=self.owner_headers,
            json={"principal_amount": 450000.0, "interest_amount": 0.0},
        )
        self.assertEqual(res_overflow.status_code, 400)

        # 4. Cannot void bank loan while active repayments exist
        res_void_loan_err = client.post(f"/cash/bank-loans/{loan_id}/void", headers=self.owner_headers)
        self.assertEqual(res_void_loan_err.status_code, 400)

        # 5. Void Repayment -> Restores Cash & Loan Balance
        res_void_rep = client.post(f"/cash/bank-loans/repayments/{repayment_id}/void", headers=self.owner_headers)
        self.assertEqual(res_void_rep.status_code, 200)
        self.assertEqual(res_void_rep.json()["status"], "voided")

        summary3 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary3["current_balance"], 500000.0)
        self.assertEqual(summary3["total_money_out"], 0.0)
        self.assertEqual(summary3["total_outstanding_bank_loans"], 500000.0)

        # 6. Void Bank Loan -> Reverses Cash In and Debt
        res_void_loan = client.post(f"/cash/bank-loans/{loan_id}/void", headers=self.owner_headers)
        self.assertEqual(res_void_loan.status_code, 200)
        self.assertEqual(res_void_loan.json()["status"], "voided")

        summary4 = client.get("/cash/summary", headers=self.owner_headers).json()
        self.assertEqual(summary4["current_balance"], 0.0)
        self.assertEqual(summary4["total_money_in"], 0.0)
        self.assertEqual(summary4["total_outstanding_bank_loans"], 0.0)


if __name__ == "__main__":
    unittest.main()
