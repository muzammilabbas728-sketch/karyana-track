"""
Database connection helper for karyana-track.

Provides a SQLite connection factory and a transaction context manager
that commits on success and rolls back on any exception.
"""

import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager

# Resolve the database path relative to the backend directory.
# Default: karyana-track/backend/karyana_track.db
_BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = os.getenv("DATABASE_PATH", str(_BASE_DIR / "karyana_track.db"))


def get_db_path() -> str:
    return os.getenv("DATABASE_PATH", str(_BASE_DIR / "karyana_track.db"))


def get_connection(db_path: str = None) -> sqlite3.Connection:
    """
    Create and return a new SQLite connection with sensible defaults.

    - Enables foreign-key enforcement (off by default in SQLite).
    - Uses Row factory so rows behave like dicts.
    """
    if db_path is None:
        db_path = get_db_path()
    conn = sqlite3.connect(db_path, timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    ensure_tables(conn)
    return conn


def ensure_tables(conn: sqlite3.Connection) -> None:
    """Ensure newly added tables exist."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS investments (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id       INTEGER NOT NULL,
            amount        REAL NOT NULL CHECK (amount > 0),
            description   TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS suppliers (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            phone       TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS supplier_payments (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id  INTEGER NOT NULL,
            user_id      INTEGER NOT NULL,
            amount       REAL NOT NULL CHECK (amount > 0),
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS inventory_purchases (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            supplier_id     INTEGER,
            supplier_name   TEXT,
            total_cost      REAL NOT NULL CHECK (total_cost >= 0),
            payment_status  TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'credit', 'pending', 'partial')),
            amount_paid     REAL NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
            notes           TEXT,
            status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
        """
    )

    # Migrate columns on inventory_purchases if created in an earlier session
    try:
        columns = [info[1] for info in conn.execute("PRAGMA table_info(inventory_purchases)").fetchall()]
        if "supplier_id" not in columns:
            conn.execute("ALTER TABLE inventory_purchases ADD COLUMN supplier_id INTEGER")
        if "amount_paid" not in columns:
            conn.execute("ALTER TABLE inventory_purchases ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0")
    except Exception:
        pass

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS purchase_items (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id    INTEGER NOT NULL,
            product_id     INTEGER NOT NULL,
            quantity       INTEGER NOT NULL CHECK (quantity > 0),
            cost_price     REAL NOT NULL CHECK (cost_price >= 0),
            total_cost     REAL NOT NULL CHECK (total_cost >= 0),
            FOREIGN KEY (purchase_id) REFERENCES inventory_purchases(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS license (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name    TEXT NOT NULL,
            device_fingerprint TEXT NOT NULL UNIQUE,
            license_key      TEXT NOT NULL,
            issued_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at       TIMESTAMP
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cash_transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            type        TEXT NOT NULL CHECK (type IN (
                            'owner_investment',
                            'owner_withdrawal',
                            'loan_given',
                            'loan_repayment',
                            'other_income',
                            'other_expense'
                        )),
            amount      REAL NOT NULL CHECK (amount > 0),
            description TEXT,
            date        DATE NOT NULL,
            status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bank_loans (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id          INTEGER NOT NULL,
            bank_name        TEXT NOT NULL,
            loan_amount      REAL NOT NULL CHECK (loan_amount > 0),
            disbursal_date   DATE NOT NULL,
            reference_number TEXT,
            description      TEXT,
            status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided', 'closed')),
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bank_loan_repayments (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_loan_id     INTEGER NOT NULL,
            user_id          INTEGER NOT NULL,
            payment_date     DATE NOT NULL,
            principal_amount REAL NOT NULL CHECK (principal_amount >= 0),
            interest_amount  REAL NOT NULL DEFAULT 0.0 CHECK (interest_amount >= 0),
            total_payment    REAL NOT NULL CHECK (total_payment > 0),
            description      TEXT,
            status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bank_loan_id) REFERENCES bank_loans(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS third_party_borrowers (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            phone       TEXT,
            notes       TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS third_party_loan_transactions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            borrower_id  INTEGER NOT NULL,
            user_id      INTEGER NOT NULL,
            type         TEXT NOT NULL CHECK (type IN ('loan_given', 'repayment')),
            amount       REAL NOT NULL CHECK (amount > 0),
            date         DATE NOT NULL,
            notes        TEXT,
            status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (borrower_id) REFERENCES third_party_borrowers(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )




@contextmanager
def transaction(db_path: str = None):
    """
    Context manager that wraps a database transaction.

    Usage:
        with transaction() as cursor:
            cursor.execute("INSERT INTO ...")

    On successful exit the transaction is committed.
    On any exception the transaction is rolled back and the exception
    is re-raised.  The connection is always closed on exit.
    """
    if db_path is None:
        db_path = get_db_path()
    conn = get_connection(db_path)
    cursor = conn.cursor()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield cursor
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def init_db(db_path: str = None) -> None:
    """
    Initialise the database by executing schema.sql.

    Safe to call multiple times — schema.sql uses CREATE TABLE IF NOT EXISTS
    and CREATE INDEX IF NOT EXISTS for idempotent execution.
    """
    if db_path is None:
        db_path = get_db_path()
    schema_file = Path(__file__).resolve().parent / "schema.sql"
    schema_sql = schema_file.read_text(encoding="utf-8")

    conn = get_connection(db_path)
    try:
        conn.executescript(schema_sql)
    finally:
        conn.close()
