"""Apply db/schema.sql to the database named by DATABASE_URL.

Usage (from the repository root):
    python db/apply_schema.py

schema.sql is idempotent, so this is safe to re-run. It is deliberately a plain
SQL file plus a thin runner rather than an Alembic migration chain -- see the
README "Trade-offs" section for why.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "db" / "schema.sql"


def resolve_database_url() -> str:
    """Read DATABASE_URL from the environment, falling back to backend/.env."""
    load_dotenv(REPO_ROOT / "backend" / ".env")

    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(
            "DATABASE_URL is not set.\n"
            "Create backend/.env from backend/.env.example, or export it directly."
        )
    return url


def main() -> None:
    url = resolve_database_url()
    sql = SCHEMA_PATH.read_text(encoding="utf-8")

    engine = create_engine(url, future=True)

    # psycopg2 executes a semicolon-separated script in one round trip, and the
    # `begin()` block makes the whole schema apply atomically.
    with engine.begin() as connection:
        connection.exec_driver_sql(sql)

        postgis_version = connection.execute(text("select postgis_version()")).scalar_one()
        tables = (
            connection.execute(
                text(
                    "select table_name from information_schema.tables "
                    "where table_schema = 'public' order by table_name"
                )
            )
            .scalars()
            .all()
        )

    print(f"Schema applied. PostGIS {postgis_version}")
    print("Tables in public schema: " + ", ".join(tables))


if __name__ == "__main__":
    main()
