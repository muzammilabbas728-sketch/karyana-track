import io
import os
import unittest
from pathlib import Path
from starlette.testclient import TestClient

TEST_DB = Path(__file__).parent / "test_backup_restore.db"
os.environ["DATABASE_PATH"] = str(TEST_DB)

from app.database import get_connection, init_db, transaction
from app.main import app
from app.routers.auth import hash_pin

client = TestClient(app)


class TestBackupRestore(unittest.TestCase):
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
                ("Owner User", "owner_bk", hash_pin("1234"), "owner"),
            )
            self.owner_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO users (name, username, pin_hash, role) VALUES (?, ?, ?, ?)",
                ("Staff User", "staff_bk", hash_pin("1234"), "staff"),
            )
            self.staff_id = cursor.lastrowid

            # Insert sample product
            cursor.execute(
                "INSERT INTO products (name, cost_price, selling_price, quantity_in_stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?)",
                ("Backup Milk", 50.0, 70.0, 10, 2),
            )

        # Login tokens
        resp_owner = client.post("/auth/login", json={"username": "owner_bk", "pin": "1234"})
        self.assertEqual(resp_owner.status_code, 200)
        self.owner_token = resp_owner.json()["token"]

        resp_staff = client.post("/auth/login", json={"username": "staff_bk", "pin": "1234"})
        self.assertEqual(resp_staff.status_code, 200)
        self.staff_token = resp_staff.json()["token"]

    def tearDown(self):
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass
        new_tmp = Path(str(TEST_DB) + ".new")
        if new_tmp.exists():
            try:
                new_tmp.unlink()
            except Exception:
                pass

    def test_backup_unauthorized(self):
        # No token
        res = client.get("/admin/backup")
        self.assertEqual(res.status_code, 401)

        # Staff token
        res_staff = client.get(
            "/admin/backup",
            headers={"Authorization": f"Bearer {self.staff_token}"},
        )
        self.assertEqual(res_staff.status_code, 403)

    def test_backup_owner_header(self):
        res = client.get(
            "/admin/backup",
            headers={"Authorization": f"Bearer {self.owner_token}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/octet-stream")
        self.assertTrue(res.content.startswith(b"SQLite format 3\x00"))
        disposition = res.headers.get("content-disposition", "")
        self.assertIn("karyana_track_backup_", disposition)
        self.assertIn(".db", disposition)

    def test_backup_owner_query_param(self):
        res = client.get(f"/admin/backup?token={self.owner_token}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/octet-stream")
        self.assertTrue(res.content.startswith(b"SQLite format 3\x00"))

    def test_restore_unauthorized(self):
        dummy_file = io.BytesIO(b"SQLite format 3\x00dummycontent")
        # No token
        res = client.post("/admin/restore", files={"file": ("backup.db", dummy_file, "application/octet-stream")})
        self.assertEqual(res.status_code, 401)

        # Staff token
        dummy_file.seek(0)
        res_staff = client.post(
            "/admin/restore",
            headers={"Authorization": f"Bearer {self.staff_token}"},
            files={"file": ("backup.db", dummy_file, "application/octet-stream")},
        )
        self.assertEqual(res_staff.status_code, 403)

    def test_restore_invalid_file(self):
        invalid_content = io.BytesIO(b"This is definitely not a sqlite database file!")
        res = client.post(
            "/admin/restore",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            files={"file": ("bad.db", invalid_content, "application/octet-stream")},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Not a valid SQLite 3 database", res.json()["detail"])

    def test_restore_valid_file(self):
        # First download valid backup content
        backup_res = client.get(
            "/admin/backup",
            headers={"Authorization": f"Bearer {self.owner_token}"},
        )
        self.assertEqual(backup_res.status_code, 200)
        backup_bytes = backup_res.content

        # Upload the backup file
        restore_file = io.BytesIO(backup_bytes)
        res = client.post(
            "/admin/restore",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            files={"file": ("karyana_track_backup.db", restore_file, "application/octet-stream")},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("Database restored successfully", res.json()["detail"])


if __name__ == "__main__":
    unittest.main()
