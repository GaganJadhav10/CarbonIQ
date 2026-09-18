"""Health and API-root tests."""

from fastapi.testclient import TestClient


def test_root_returns_api_info(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "CarbonIQ API"
    assert body["docs"] == "/docs"


def test_health_reports_database_and_postgis(client: TestClient) -> None:
    """The health check must actually reach PostGIS, not just return 'ok'."""
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    # postgis_version() returns something like "3.4 USE_GEOS=1 ...".
    assert body["postgis_version"]


def test_openapi_schema_is_served(client: TestClient) -> None:
    """Guards the /docs deliverable referenced in the submission."""
    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/api/health" in response.json()["paths"]
