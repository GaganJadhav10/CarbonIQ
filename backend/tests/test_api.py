"""API behaviour tests: authentication, ownership scoping, and geometry handling.

These run against a real PostGIS database (a throwaway container in CI). The
geospatial assertions in particular cannot be made against a mock -- the thing
under test is whether PostGIS gives back exactly what it was given.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

# A closed square near Delhi. Coordinates are deliberately asymmetric so that a
# transposed lon/lat would produce a visibly different, failing result.
POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [77.10, 28.50],
            [77.20, 28.50],
            [77.20, 28.60],
            [77.10, 28.60],
            [77.10, 28.50],
        ]
    ],
}


def unique_email() -> str:
    """A fresh email per test, so tests never collide on the unique constraint."""
    return f"test-{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture
def account(client: TestClient) -> dict:
    """Register a new user and return an auth header plus their email."""
    email = unique_email()
    response = client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert response.status_code == 201

    token = response.json()["access_token"]
    return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def project(client: TestClient, account: dict) -> dict:
    response = client.post(
        "/api/projects", json={"name": "Test Project"}, headers=account["headers"]
    )
    assert response.status_code == 201
    return response.json()


# --- Authentication ----------------------------------------------------------


class TestAuthentication:
    def test_register_returns_a_usable_token(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/register", json={"email": unique_email(), "password": "password123"}
        )

        assert response.status_code == 201
        body = response.json()
        assert body["token_type"] == "bearer"
        assert body["expires_in"] > 0
        # The password hash must never appear in a response.
        assert "password" not in str(body).lower().replace("password123", "")

    def test_duplicate_email_is_rejected(self, client: TestClient, account: dict) -> None:
        response = client.post(
            "/api/auth/register", json={"email": account["email"], "password": "password123"}
        )

        assert response.status_code == 409

    def test_short_password_is_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/register", json={"email": unique_email(), "password": "short"}
        )

        assert response.status_code == 422

    def test_login_with_wrong_password_fails(self, client: TestClient, account: dict) -> None:
        response = client.post(
            "/api/auth/login", json={"email": account["email"], "password": "not-the-password"}
        )

        assert response.status_code == 401

    def test_unknown_email_gives_the_same_error_as_a_wrong_password(
        self, client: TestClient
    ) -> None:
        """Identical responses stop the endpoint being used to enumerate accounts."""
        unknown = client.post(
            "/api/auth/login", json={"email": unique_email(), "password": "password123"}
        )

        assert unknown.status_code == 401
        assert unknown.json()["detail"] == "Incorrect email or password."

    @pytest.mark.parametrize(
        "method,path",
        [("GET", "/api/projects"), ("POST", "/api/projects"), ("GET", "/api/sites")],
    )
    def test_protected_routes_reject_anonymous_requests(
        self, client: TestClient, method: str, path: str
    ) -> None:
        response = client.request(method, path, json={})

        assert response.status_code == 401

    def test_a_malformed_token_is_rejected(self, client: TestClient) -> None:
        response = client.get("/api/projects", headers={"Authorization": "Bearer not-a-real-token"})

        assert response.status_code == 401


# --- Projects ----------------------------------------------------------------


class TestProjects:
    def test_create_then_list(self, client: TestClient, account: dict) -> None:
        client.post(
            "/api/projects",
            json={"name": "Mangrove Monitoring", "description": "Blue carbon."},
            headers=account["headers"],
        )

        response = client.get("/api/projects", headers=account["headers"])

        assert response.status_code == 200
        projects = response.json()
        assert len(projects) == 1
        assert projects[0]["name"] == "Mangrove Monitoring"
        assert projects[0]["site_count"] == 0

    def test_projects_are_not_visible_to_other_users(
        self, client: TestClient, account: dict, project: dict
    ) -> None:
        other = client.post(
            "/api/auth/register", json={"email": unique_email(), "password": "password123"}
        ).json()
        other_headers = {"Authorization": f"Bearer {other['access_token']}"}

        assert client.get("/api/projects", headers=other_headers).json() == []
        # 404 rather than 403: a 403 would confirm the id exists.
        assert (
            client.get(f"/api/projects/{project['id']}", headers=other_headers).status_code == 404
        )


# --- Sites and geometry ------------------------------------------------------


class TestSites:
    def test_polygon_survives_the_postgis_round_trip_exactly(
        self, client: TestClient, account: dict, project: dict
    ) -> None:
        """The critical geospatial test.

        A silent coordinate-order or SRID mismatch would still store *a*
        polygon and still render *a* shape, just in the wrong place -- so this
        asserts byte-for-byte coordinate equality rather than merely that a
        geometry came back.
        """
        created = client.post(
            "/api/sites",
            json={"project_id": project["id"], "name": "Block A", "boundary": POLYGON},
            headers=account["headers"],
        )
        assert created.status_code == 201

        refetched = client.get(f"/api/sites/{created.json()['id']}", headers=account["headers"])

        assert refetched.status_code == 200
        assert refetched.json()["geometry"]["coordinates"] == POLYGON["coordinates"]

    def test_area_is_computed_geodesically(
        self, client: TestClient, account: dict, project: dict
    ) -> None:
        """~0.1 x 0.1 degrees near 28.5N is roughly 10,800 hectares.

        A degrees-squared area would be a meaningless fraction, so a plausible
        magnitude proves the geography cast is actually being applied.
        """
        response = client.post(
            "/api/sites",
            json={"project_id": project["id"], "name": "Block B", "boundary": POLYGON},
            headers=account["headers"],
        )

        assert 10_000 < response.json()["properties"]["area_hectares"] < 12_000

    @pytest.mark.parametrize(
        "coordinates,reason",
        [
            ([[[0, 0], [1, 1], [2, 2]]], "ring is not closed and too short"),
            ([[[0, 0], [1, 0], [1, 1], [0, 1]]], "first and last positions differ"),
            ([[[200, 0], [201, 0], [201, 1], [200, 0]]], "longitude out of range"),
        ],
    )
    def test_invalid_polygons_are_rejected_with_422(
        self, client: TestClient, account: dict, project: dict, coordinates: list, reason: str
    ) -> None:
        """Validation happens in Pydantic, so bad geometry never reaches the database."""
        response = client.post(
            "/api/sites",
            json={
                "project_id": project["id"],
                "name": "Invalid",
                "boundary": {"type": "Polygon", "coordinates": coordinates},
            },
            headers=account["headers"],
        )

        assert response.status_code == 422, reason

    def test_sites_are_returned_as_a_geojson_feature_collection(
        self, client: TestClient, account: dict, project: dict
    ) -> None:
        client.post(
            "/api/sites",
            json={"project_id": project["id"], "name": "Block C", "boundary": POLYGON},
            headers=account["headers"],
        )

        body = client.get("/api/sites", headers=account["headers"]).json()

        assert body["type"] == "FeatureCollection"
        assert body["features"][0]["type"] == "Feature"
        assert body["features"][0]["properties"]["project_name"] == project["name"]

    def test_cannot_add_a_site_to_someone_elses_project(
        self, client: TestClient, project: dict
    ) -> None:
        other = client.post(
            "/api/auth/register", json={"email": unique_email(), "password": "password123"}
        ).json()

        response = client.post(
            "/api/sites",
            json={"project_id": project["id"], "name": "Intrusion", "boundary": POLYGON},
            headers={"Authorization": f"Bearer {other['access_token']}"},
        )

        assert response.status_code == 404


# --- Metrics -----------------------------------------------------------------


class TestMetrics:
    def test_metrics_endpoint_returns_empty_series_for_a_new_site(
        self, client: TestClient, account: dict, project: dict
    ) -> None:
        site = client.post(
            "/api/sites",
            json={"project_id": project["id"], "name": "Fresh", "boundary": POLYGON},
            headers=account["headers"],
        ).json()

        response = client.get(f"/api/sites/{site['id']}/metrics", headers=account["headers"])

        assert response.status_code == 200
        assert response.json()["series"] == []

    def test_metrics_for_an_unknown_site_are_404(self, client: TestClient, account: dict) -> None:
        response = client.get("/api/sites/99999999/metrics", headers=account["headers"])

        assert response.status_code == 404
