import os
import unittest
from pathlib import Path
from starlette.testclient import TestClient

TEST_DB = Path.cwd() / "test_license_unit.db"
os.environ["DATABASE_PATH"] = str(TEST_DB)

from app.database import init_db
from app.licensing import generate_license_key, get_device_fingerprint, verify_license
from app.main import app

client = TestClient(app)


class TestLicensing(unittest.TestCase):
    def setUp(self):
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass
        init_db(str(TEST_DB))

    def tearDown(self):
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass

    def test_fingerprint_and_key_generation(self):
        fp = get_device_fingerprint()
        self.assertEqual(len(fp), 19)
        self.assertEqual(fp.count("-"), 3)

        key = generate_license_key(fp)
        self.assertEqual(len(key), 23)
        self.assertEqual(key.count("-"), 3)

    def test_license_endpoints_unauthenticated(self):
        fp = get_device_fingerprint()

        # Check initial unlicensed state
        res = client.get("/license")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["licensed"])
        self.assertEqual(res.json()["fingerprint"], fp)

        # Invalid activation key fails
        bad_res = client.post("/license/activate", json={"license_key": "BAD-KEY-1234", "customer_name": "Customer Alpha"})
        self.assertEqual(bad_res.status_code, 400)

        # Valid activation succeeds (license key independent of customer_name)
        valid_key = generate_license_key(fp)
        good_res = client.post("/license/activate", json={"license_key": valid_key, "customer_name": "Customer Alpha"})
        self.assertEqual(good_res.status_code, 200)
        self.assertTrue(good_res.json()["activated"])

        # Check status again
        res_after = client.get("/license")
        self.assertEqual(res_after.status_code, 200)
        self.assertTrue(res_after.json()["licensed"])
        self.assertEqual(res_after.json()["customer_name"], "Customer Alpha")


if __name__ == "__main__":
    unittest.main()
