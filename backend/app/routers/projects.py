"""Project CRUD. Every route is owner-scoped and behind authentication."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Site, User
from app.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    """List the current user's projects, newest first, with site counts.

    The site count is computed in one grouped query rather than by iterating
    projects and counting each one -- an N+1 that would be invisible with three
    demo projects and painful with three hundred.
    """
    rows = db.execute(
        select(Project, func.count(Site.id))
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
            created_at=project.created_at,
            site_count=site_count,
        )
        for project, site_count in rows
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
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        site_count=0,
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

    site_count = db.scalar(select(func.count(Site.id)).where(Site.project_id == project.id))

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        site_count=site_count or 0,
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
