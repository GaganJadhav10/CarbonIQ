"""Seed the database with a demo account, projects, sites, and metric history.

DATA PROVENANCE
---------------
Every number this script writes is SYNTHETIC. No real measurement data is used.

The brief permits synthetic or public datasets provided the choice is
documented, and synthetic data is the right call here for two reasons: the
polygons are arbitrary demo areas that no real monitoring programme has
published figures for, and a generated series can be shaped to exercise the
charting layer properly (multiple metrics, 24 monthly observations each,
visible trend plus noise) in a way a sparse real extract would not.

Generation is deterministic -- a fixed RNG seed -- so the demo looks identical
on every machine and re-running does not silently change the charts.

The site polygons are rough rectangles over real protected areas in India
(Western Ghats, Sundarbans, Nilgiris) chosen only so the map opens somewhere
plausible. They are not official boundaries.

Usage (from the repository root):
    python db/seed.py
    python db/seed.py --reset    # delete this demo user's data first
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.orm import Session, sessionmaker

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.models import Project, SiteMetric, User  # noqa: E402
from app.security import hash_password  # noqa: E402

DEMO_EMAIL = "demo@carboniq.app"
DEMO_PASSWORD = "carboniq-demo-2024"

RANDOM_SEED = 20240401
MONTHS_OF_HISTORY = 24


def _rectangle(west: float, south: float, east: float, north: float) -> dict:
    """Build a closed GeoJSON polygon ring from a bounding box."""
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]
        ],
    }


# (project name, type, description, [(site name, bbox), ...])
DEMO_PROJECTS: list[tuple[str, str, str, list[tuple[str, dict]]]] = [
    (
        "Western Ghats reforestation",
        "carbon",
        "Native species restoration across degraded slopes in the Western Ghats, "
        "tracking carbon accumulation and canopy recovery.",
        [
            ("Agumbe slope block A", _rectangle(75.06, 13.49, 75.14, 13.55)),
            ("Kudremukh corridor", _rectangle(75.22, 13.18, 75.32, 13.26)),
        ],
    ),
    (
        "Sundarbans mangrove monitoring",
        "both",
        "Mangrove extent and blue-carbon monitoring across tidal creek systems "
        "in the Sundarbans delta.",
        [
            ("Netidhopani creek", _rectangle(88.78, 21.86, 88.88, 21.94)),
            ("Sajnekhali buffer", _rectangle(88.80, 22.10, 88.90, 22.18)),
        ],
    ),
    (
        "Nilgiris biodiversity baseline",
        "biodiversity",
        "Shola grassland biodiversity baselining ahead of a restoration "
        "programme in the Nilgiri hills.",
        [
            ("Mukurthi plateau", _rectangle(76.48, 11.20, 76.56, 11.28)),
        ],
    ),
]

# The five indicators the dashboard charts, matching DESIGN.md section 5.4.
#
# (metric name, unit, start, monthly drift, noise amplitude, decimals, floor, ceiling)
#
# `human_intrusion_index` drifts downward on purpose: it is the one metric where
# a falling value is an improvement, which exercises the better/worse rule in
# the change indicator rather than leaving it untested.
METRIC_PROFILES: list[tuple[str, str, float, float, float, int, float, float]] = [
    ("biodiversity_score", "score", 58.0, 0.42, 1.4, 1, 0.0, 100.0),
    ("species_richness", "species", 68.0, 0.40, 3.0, 0, 0.0, 400.0),
    ("human_intrusion_index", "index", 34.0, -0.35, 1.6, 1, 0.0, 100.0),
    ("ndvi", "index", 0.52, 0.006, 0.02, 2, -1.0, 1.0),
    ("carbon_stock", "tCO2e", 1180.0, 14.5, 9.0, 1, 0.0, 1_000_000.0),
]


def _month_starts(count: int, end: date) -> list[date]:
    """Return `count` month-start dates ending with the month of `end`."""
    months = []
    year, month = end.year, end.month
    for _ in range(count):
        months.append(date(year, month, 1))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return sorted(months)


def _generate_series(
    rng: random.Random,
    profile: tuple[str, str, float, float, float, int, float, float],
    dates: list[date],
) -> list[tuple[str, str, float, date]]:
    """Generate one metric's history: a linear trend plus bounded noise."""
    name, unit, start, drift, noise, decimals, floor, ceiling = profile
    rows = []

    for index, observed_on in enumerate(dates):
        value = start + drift * index + rng.uniform(-noise, noise)

        # Clamp to the metric's real range so the noise reads as measurement
        # variance rather than producing an impossible value (a negative species
        # count, or an NDVI above 1).
        value = min(max(value, floor), ceiling)

        rows.append((name, unit, round(value, decimals), observed_on))

    return rows


def seed(session: Session, reset: bool) -> None:
    rng = random.Random(RANDOM_SEED)

    user = session.scalar(select(User).where(User.email == DEMO_EMAIL))

    if user and reset:
        print(f"Removing existing data for {DEMO_EMAIL}...")
        session.execute(delete(Project).where(Project.owner_id == user.id))
        session.commit()
    elif user:
        existing = session.scalar(select(Project).where(Project.owner_id == user.id).limit(1))
        if existing is not None:
            print(
                f"{DEMO_EMAIL} already has data. Re-run with --reset to rebuild it.",
            )
            return

    if user is None:
        user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
        session.add(user)
        session.flush()
        print(f"Created demo user {DEMO_EMAIL}")

    dates = _month_starts(MONTHS_OF_HISTORY, date.today().replace(day=1))
    site_total = 0
    metric_total = 0

    for project_name, project_type, description, site_specs in DEMO_PROJECTS:
        project = Project(
            owner_id=user.id,
            name=project_name,
            description=description,
            project_type=project_type,
        )
        session.add(project)
        session.flush()

        for site_name, polygon in site_specs:
            # Insert the geometry through PostGIS, exactly as the API does, so
            # seeded sites and drawn sites are stored identically.
            site_id = session.execute(
                text(
                    "insert into sites (project_id, name, boundary) "
                    "values (:project_id, :name, "
                    "ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)) returning id"
                ),
                {
                    "project_id": project.id,
                    "name": site_name,
                    "geojson": json.dumps(polygon),
                },
            ).scalar_one()
            site_total += 1

            for profile in METRIC_PROFILES:
                for name, unit, value, observed_on in _generate_series(rng, profile, dates):
                    session.add(
                        SiteMetric(
                            site_id=site_id,
                            metric_name=name,
                            unit=unit,
                            value=value,
                            recorded_at=observed_on,
                        )
                    )
                    metric_total += 1

    session.commit()

    print(f"Seeded {len(DEMO_PROJECTS)} projects, {site_total} sites, {metric_total} metric rows.")
    print(f"\nDemo login:  {DEMO_EMAIL}  /  {DEMO_PASSWORD}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset", action="store_true", help="Delete the demo user's existing projects first."
    )
    args = parser.parse_args()

    load_dotenv(REPO_ROOT / "backend" / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set. Create backend/.env from backend/.env.example.")

    engine = create_engine(url, future=True)
    with sessionmaker(bind=engine, future=True)() as session:
        seed(session, reset=args.reset)


if __name__ == "__main__":
    main()
