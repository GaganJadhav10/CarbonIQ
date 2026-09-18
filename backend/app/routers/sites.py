"""Geospatial site CRUD and per-site metric history.

Geometry conversion is delegated to PostGIS itself -- ST_GeomFromGeoJSON on the
way in, ST_AsGeoJSON on the way out -- rather than being marshalled in Python.
That keeps a single authority for coordinate handling and avoids adding a
Shapely/GEOS native dependency to the deployment.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2 import Geography
from sqlalchemy import Select, cast, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Site, SiteMetric, User
from app.routers.projects import get_owned_project
from app.schemas import (
    MetricPoint,
    MetricSeries,
    PolygonGeometry,
    SiteCreate,
    SiteFeature,
    SiteFeatureCollection,
    SiteMetricsResponse,
    SiteProperties,
)

router = APIRouter(prefix="/sites", tags=["sites"])

SQUARE_METRES_PER_HECTARE = 10_000


def _site_feature_select(current_user: User) -> Select:
    """Select every column needed to build a GeoJSON Feature, owner-scoped.

    ST_AsGeoJSON returns the geometry as a JSON string; casting the boundary to
    `geography` before ST_Area gives a true geodesic area in square metres
    rather than meaningless squared degrees.
    """
    return (
        select(
            Site.id,
            Site.name,
            Site.project_id,
            Project.name.label("project_name"),
            Site.created_at,
            func.ST_AsGeoJSON(Site.boundary).label("geometry"),
            (
                func.ST_Area(cast(Site.boundary, Geography(geometry_type="POLYGON", srid=4326)))
                / SQUARE_METRES_PER_HECTARE
            ).label("area_hectares"),
        )
        .join(Project, Project.id == Site.project_id)
        .where(Project.owner_id == current_user.id)
    )


def _row_to_feature(row) -> SiteFeature:
    return SiteFeature(
        id=row.id,
        geometry=PolygonGeometry.model_validate(json.loads(row.geometry)),
        properties=SiteProperties(
            id=row.id,
            name=row.name,
            project_id=row.project_id,
            project_name=row.project_name,
            created_at=row.created_at,
            area_hectares=round(float(row.area_hectares), 2),
        ),
    )


@router.get("", response_model=SiteFeatureCollection)
def list_sites(
    project_id: int | None = Query(
        default=None, description="Restrict to one project. Omit for every site the user owns."
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteFeatureCollection:
    """List sites as a GeoJSON FeatureCollection.

    Returned in GeoJSON form so the frontend can pass the response straight to
    Mapbox as a source with no reshaping -- one fewer place for a coordinate
    mistake to be introduced.
    """
    statement = _site_feature_select(current_user)

    if project_id is not None:
        # Resolve through the ownership check so an unrelated project id gives a
        # clean 404 instead of a silently empty list.
        get_owned_project(project_id, db, current_user)
        statement = statement.where(Site.project_id == project_id)

    rows = db.execute(statement.order_by(Site.created_at.desc())).all()
    return SiteFeatureCollection(features=[_row_to_feature(row) for row in rows])


@router.post("", response_model=SiteFeature, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteFeature:
    """Create a site from a polygon drawn on the map."""
    get_owned_project(payload.project_id, db, current_user)

    geojson = payload.boundary.model_dump_json()

    # ST_SetSRID is belt-and-braces: GeoJSON is defined as WGS 84, but stating
    # the SRID explicitly means the column constraint can never be violated by
    # a driver that omits it.
    site = Site(
        project_id=payload.project_id,
        name=payload.name,
        boundary=func.ST_SetSRID(func.ST_GeomFromGeoJSON(geojson), 4326),
    )
    db.add(site)
    db.commit()

    row = db.execute(_site_feature_select(current_user).where(Site.id == site.id)).one()
    return _row_to_feature(row)


@router.get("/{site_id}", response_model=SiteFeature)
def get_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteFeature:
    """Fetch one site the current user owns."""
    row = db.execute(_site_feature_select(current_user).where(Site.id == site_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")
    return _row_to_feature(row)


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a site. Its metrics cascade."""
    site = db.scalar(
        select(Site)
        .join(Project, Project.id == Site.project_id)
        .where(Site.id == site_id, Project.owner_id == current_user.id)
    )
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")

    db.delete(site)
    db.commit()


@router.get("/{site_id}/metrics", response_model=SiteMetricsResponse)
def get_site_metrics(
    site_id: int,
    metric_name: str | None = Query(default=None, description="Restrict to a single metric."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteMetricsResponse:
    """Return a site's metric history, grouped into one series per metric.

    Grouping server-side means the chart component receives data in exactly the
    shape it renders, rather than each client reimplementing the same pivot.
    """
    site = db.scalar(
        select(Site)
        .join(Project, Project.id == Site.project_id)
        .where(Site.id == site_id, Project.owner_id == current_user.id)
    )
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found.")

    statement = (
        select(SiteMetric.metric_name, SiteMetric.unit, SiteMetric.recorded_at, SiteMetric.value)
        .where(SiteMetric.site_id == site_id)
        .order_by(SiteMetric.metric_name, SiteMetric.recorded_at)
    )
    if metric_name:
        statement = statement.where(SiteMetric.metric_name == metric_name)

    series: dict[str, MetricSeries] = {}
    for row in db.execute(statement):
        if row.metric_name not in series:
            series[row.metric_name] = MetricSeries(
                metric_name=row.metric_name, unit=row.unit, points=[]
            )
        series[row.metric_name].points.append(
            MetricPoint(recorded_at=row.recorded_at, value=float(row.value))
        )

    return SiteMetricsResponse(
        site_id=site.id,
        site_name=site.name,
        series=list(series.values()),
    )
