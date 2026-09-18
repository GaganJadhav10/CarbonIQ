"""Shared pytest fixtures.

Tests run against a real PostGIS database, never against mocks: the whole point
of the geospatial layer is that PostGIS round-trips geometry correctly, which a
mocked session cannot demonstrate. CI provides a throwaway postgis container;
locally, export DATABASE_URL to point at any PostGIS instance.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """A TestClient bound to the real application."""
    with TestClient(app) as test_client:
        yield test_client
