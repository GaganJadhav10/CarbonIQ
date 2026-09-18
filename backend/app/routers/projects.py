"""Project CRUD. Every route is owner-scoped and behind authentication."""

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Site, User
from app.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])

SQUARE_METRES_PER_HECTARE = 10_000


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    """List the current user's projects, newest first, with ledger columns.

    Site count, total area and last-updated are all computed in one grouped
    query rather than by iterating projects and querying each -- an N+1 that is
    invisible with three demo projects and painful with three hundred.

    Area is summed after casting to `geography`, which gives true geodesic
    square metres rather than meaningless squared degrees.
    """
    area_hectares = (
        func.coalesce(
            func.sum(
                func.ST_Area(cast(Site.boundary, Geography(geometry_type="POLYGON", srid=4326)))
            ),
            0,
        )
        / SQUARE_METRES_PER_HECTARE
    )

    rows = db.execute(
        select(
            Project,
            func.count(Site.id).label("site_count"),
            area_hectares.label("total_area_hectares"),
            func.max(Site.created_at).label("last_site_at"),
        )
        .outerjoin(Site, Site.project_id == Project.id)
        .where(Project.owner_id == current_user.id)
        .group_by(Project.id)
        .order_by(Project.created_at.desc())
    ).all()

    return [
        ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            project_type=project.project_type,
            created_at=project.created_at,
            site_count=site_count,
            total_area_hectares=round(float(total_area), 2),
            # "Last updated" is the most recent site added, falling back to the
            # project's own creation for a project with no sites yet.
            last_updated=last_site_at or project.created_at,
        )
        for project, site_count, total_area, last_site_at in rows
    ]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    """Create a project owned by the current user."""
    project = Project(
        owner_id=current_user.id,
        name=payload.name,
        description=payload.description or None,
        project_type=payload.project_type,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        project_type=project.project_type,
        created_at=project.created_at,
        site_count=0,
        total_area_hectares=0.0,
        last_updated=project.created_at,
    )


def get_owned_project(project_id: int, db: Session, current_user: User) -> Project:
    """Fetch a project, or 404 if it does not exist *or* is not the caller's.

    Deliberately 404 and not 403: telling a stranger "this exists but is not
    yours" leaks which project ids are real.
    """
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == current_user.id)
    )
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    """Fetch one of the current user's projects by id."""
    project = get_owned_project(project_id, db, current_user)

    area_hectares = (
        func.coalesce(
            func.sum(
                func.ST_Area(cast(Site.boundary, Geography(geometry_type="POLYGON", srid=4326)))
            ),
            0,
        )
        / SQUARE_METRES_PER_HECTARE
    )

    site_count, total_area, last_site_at = db.execute(
        select(
            func.count(Site.id),
            area_hectares,
            func.max(Site.created_at),
        ).where(Site.project_id == project.id)
    ).one()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        project_type=project.project_type,
        created_at=project.created_at,
        site_count=site_count or 0,
        total_area_hectares=round(float(total_area), 2),
        last_updated=last_site_at or project.created_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a project. Its sites and their metrics cascade."""
    project = get_owned_project(project_id, db, current_user)
    db.delete(project)
    db.commit()
