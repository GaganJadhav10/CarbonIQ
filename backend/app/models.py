"""SQLAlchemy ORM models.

These mirror db/schema.sql, which remains the source of truth for the database
structure. The models exist to give the application layer typed access and
relationship traversal, not to create tables.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    projects: Mapped[list[Project]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # 'carbon' | 'biodiversity' | 'both'. Constrained in the database; the
    # allowed values are mirrored by the Pydantic Literal in schemas.py.
    project_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="carbon")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="projects")
    sites: Mapped[list[Site]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)

    # EPSG:4326 (WGS 84 lon/lat) -- the coordinate system GeoJSON and Mapbox GL
    # JS both use natively, so the polygon never needs reprojecting anywhere in
    # the round trip.
    #
    # spatial_index=False because db/schema.sql already creates the GiST index;
    # leaving it True makes GeoAlchemy2 try to create a duplicate.
    boundary: Mapped[str] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped[Project] = relationship(back_populates="sites")
    metrics: Mapped[list[SiteMetric]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )


class SiteMetric(Base):
    """One observation: a single metric for a single site on a single date."""

    __tablename__ = "site_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    metric_name: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[date] = mapped_column(Date, nullable=False)

    site: Mapped[Site] = relationship(back_populates="metrics")

    __table_args__ = (
        Index("site_metrics_site_metric_date_idx", "site_id", "metric_name", "recorded_at"),
    )
