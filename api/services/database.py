"""Database connection and session management."""

import logging
import os
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, Session

from api.config import config
import api.models  # noqa: F401 - ensure all model metadata is registered
from api.models.base import Base

logger = logging.getLogger(__name__)

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

engine = create_engine(
    config.DATABASE_URL,
    echo=config.DEBUG,
    pool_pre_ping=True,
)

# Enable WAL mode and foreign keys for SQLite
if "sqlite" in config.DATABASE_URL:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


@contextmanager
def get_db() -> Iterator[Session]:
    """Yield a database session with auto-commit/rollback."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _migrate_missing_columns():
    """Add any columns defined in models but missing from the SQLite database.

    SQLAlchemy's create_all only creates missing *tables*, not missing columns
    on existing tables. This lightweight migration covers schema drift for
    SQLite (which supports ADD COLUMN but not DROP/ALTER).
    """
    if "sqlite" not in config.DATABASE_URL:
        return

    insp = inspect(engine)
    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if not insp.has_table(table_name):
                continue
            existing = {c["name"] for c in insp.get_columns(table_name)}
            for col in table.columns:
                if col.name not in existing:
                    col_type = col.type.compile(engine.dialect)
                    stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"
                    logger.info("Migrating: %s", stmt)
                    conn.execute(text(stmt))

        # Backfill newly-added user security fields for existing accounts.
        if insp.has_table("users"):
            conn.execute(
                text(
                    "UPDATE users SET email_verified = 1 "
                    "WHERE email_verified IS NULL"
                )
            )
            conn.execute(
                text(
                    "UPDATE users SET is_active = 1 "
                    "WHERE is_active IS NULL"
                )
            )
            conn.execute(
                text(
                    "UPDATE users SET is_admin = 0 "
                    "WHERE is_admin IS NULL"
                )
            )


_init_done = False


def init_database():
    """Create all tables and migrate any missing columns.

    Safe to call from multiple gunicorn workers -- uses a module-level
    flag to skip redundant work and wraps DDL in a try/except so that
    'already exists' errors from a concurrent worker don't crash the
    process.
    """
    global _init_done
    if _init_done:
        return

    try:
        Base.metadata.create_all(bind=engine, checkfirst=True)
    except Exception as exc:
        msg = str(exc)
        if "already exists" in msg:
            logger.warning(
                "create_all: 'already exists' (safe): %s", exc,
            )
        elif "database is locked" in msg:
            logger.warning(
                "create_all: DB locked (another worker): %s", exc,
            )
        else:
            raise

    try:
        _migrate_missing_columns()
    except Exception as exc:
        msg = str(exc)
        if "already exists" in msg or "database is locked" in msg:
            logger.warning(
                "Migration concurrency issue (safe): %s", exc,
            )
        else:
            raise

    _init_done = True
    logger.info("Database initialized successfully.")


def reset_database():
    """Drop and recreate all tables. WARNING: destroys all data."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset successfully.")
