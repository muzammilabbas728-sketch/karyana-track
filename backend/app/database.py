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


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """
    Create and return a new SQLite connection with sensible defaults.

    - Enables foreign-key enforcement (off by default in SQLite).
    - Uses Row factory so rows behave like dicts.
    """
    conn = sqlite3.connect(db_path, timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def transaction(db_path: str = DB_PATH):
    """
    Context manager that wraps a database transaction.

    Usage:
        with transaction() as cursor:
            cursor.execute("INSERT INTO ...")

    On successful exit the transaction is committed.
    On any exception the transaction is rolled back and the exception
    is re-raised.  The connection is always closed on exit.
    """
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


def init_db(db_path: str = DB_PATH) -> None:
    """
    Initialise the database by executing schema.sql.

    Safe to call multiple times — CREATE TABLE IF NOT EXISTS semantics
    are intentionally *not* used in the schema so that accidental
    re-runs surface errors early.  Guard calls to this function yourself.
    """
    schema_file = Path(__file__).resolve().parent / "schema.sql"
    schema_sql = schema_file.read_text(encoding="utf-8")

    conn = get_connection(db_path)
    try:
        conn.executescript(schema_sql)
    finally:
        conn.close()
