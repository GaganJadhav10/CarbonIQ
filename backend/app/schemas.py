"""Pydantic request and response models.

Keeping these separate from the SQLAlchemy models means the API contract is
explicit and independently reviewable, and that internal columns (such as
password_hash) can never leak into a response by accident.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# --- Health ------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str = Field(description="'ok' when every dependency is reachable.")
    environment: str = Field(description="Deployment environment name.")
    database: str = Field(description="Database connectivity state.")
    postgis_version: str = Field(description="PostGIS version reported by the database.")


class ApiInfo(BaseModel):
    name: str
    docs: str
    health: str


# --- Auth --------------------------------------------------------------------

# bcrypt silently truncates beyond 72 bytes, so the maximum is enforced here
# rather than letting two long passwords become interchangeable.
Password = Annotated[str, Field(min_length=8, max_length=72)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: Password


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds.")
    user: UserResponse


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


# --- Projects ----------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "description")
    @classmethod
    def strip_whitespace(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    site_count: int = 0


# --- Sites -------------------------------------------------------------------


class PolygonGeometry(BaseModel):
    """A GeoJSON Polygon, validated before it reaches PostGIS.

    Validating shape here means a malformed drawing returns a clear 422 instead
    of a database-level error leaking through as a 500.
    """

    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_rings(
        cls, rings: list[list[tuple[float, float]]]
    ) -> list[list[tuple[float, float]]]:
        if not rings:
            raise ValueError("A polygon needs at least one linear ring.")

        for ring in rings:
            # A closed ring repeats its first point, so 4 positions is the
            # minimum that encloses any area.
            if len(ring) < 4:
                raise ValueError("Each ring needs at least 4 positions to be closed.")
            if ring[0] != ring[-1]:
                raise ValueError("Each ring must be closed: first and last positions must match.")
            for longitude, latitude in ring:
                if not -180 <= longitude <= 180:
                    raise ValueError(f"Longitude {longitude} is outside [-180, 180].")
                if not -90 <= latitude <= 90:
                    raise ValueError(f"Latitude {latitude} is outside [-90, 90].")

        return rings


class SiteCreate(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=200)
    boundary: PolygonGeometry

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()


class SiteProperties(BaseModel):
    id: int
    name: str
    project_id: int
    project_name: str
    created_at: datetime
    area_hectares: float = Field(description="Geodesic area, computed by PostGIS.")


class SiteFeature(BaseModel):
    """One site as a GeoJSON Feature.

    Sites are returned as GeoJSON rather than a bespoke shape so the frontend
    can hand the payload straight to Mapbox with no transformation step -- one
    less place for a coordinate-order mistake to creep in.
    """

    type: Literal["Feature"] = "Feature"
    id: int
    geometry: PolygonGeometry
    properties: SiteProperties


class SiteFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[SiteFeature]


# --- Metrics -----------------------------------------------------------------


class MetricPoint(BaseModel):
    recorded_at: date
    value: float


class MetricSeries(BaseModel):
    """One metric's full history for a site, ready to chart."""

    metric_name: str
    unit: str | None
    points: list[MetricPoint]


class SiteMetricsResponse(BaseModel):
    site_id: int
    site_name: str
    series: list[MetricSeries]
