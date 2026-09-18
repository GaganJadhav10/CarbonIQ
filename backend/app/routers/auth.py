"""Registration, login, and one-click demo access."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Site, User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# The seeded account whose projects are cloned for each demo visitor.
DEMO_TEMPLATE_EMAIL = "demo@carboniq.app"


def _issue_token(user: User) -> TokenResponse:
    token, expires_in = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Create an account and sign the new user straight in.

    Returning a token here rather than forcing an immediate second login round
    trip is a small thing, but it removes a pointless step from the first-run
    experience.
    """
    email = payload.email.lower()

    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return _issue_token(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Exchange email and password for a JWT."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))

    # One generic message for both "no such user" and "wrong password", so the
    # endpoint cannot be used to enumerate which emails have accounts.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _issue_token(user)


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the signed-in user; used by the frontend to validate a stored token."""
    return UserResponse.model_validate(current_user)


def _clone_demo_data(db: Session, template: User, guest: User) -> None:
    """Copy the template account's projects, sites, and metrics to `guest`.

    Rows are walked explicitly so each new id is captured directly, rather than
    matching cloned rows back to their originals by name -- two projects may
    legitimately share a name, and a name-based join would mis-link them.

    Geometry and metric rows are copied by INSERT ... SELECT, so the polygon is
    duplicated inside PostGIS and the (much larger) metric history never travels
    through the application at all.
    """
    projects = db.scalars(
        select(Project).where(Project.owner_id == template.id).order_by(Project.id)
    ).all()

    for source_project in projects:
        clone = Project(
            owner_id=guest.id,
            name=source_project.name,
            description=source_project.description,
        )
        db.add(clone)
        db.flush()

        source_site_ids = db.scalars(
            select(Site.id).where(Site.project_id == source_project.id).order_by(Site.id)
        ).all()

        for source_site_id in source_site_ids:
            new_site_id = db.execute(
                text(
                    "insert into sites (project_id, name, boundary) "
                    "select :project_id, name, boundary from sites where id = :source_id "
                    "returning id"
                ),
                {"project_id": clone.id, "source_id": source_site_id},
            ).scalar_one()

            db.execute(
                text(
                    "insert into site_metrics "
                    "(site_id, metric_name, value, unit, recorded_at) "
                    "select :site_id, metric_name, value, unit, recorded_at "
                    "from site_metrics where site_id = :source_id"
                ),
                {"site_id": new_site_id, "source_id": source_site_id},
            )


@router.post("/demo", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def create_demo_session(db: Session = Depends(get_db)) -> TokenResponse:
    """Create a throwaway guest account preloaded with the demo dataset.

    This exists so a reviewer can see the product in one click without typing
    credentials, while authentication itself stays fully enforced -- the guest
    receives a real JWT and is subject to exactly the same ownership checks as
    any other user.

    Each visitor gets their own copy rather than sharing one account, so drawing
    or deleting sites during a demo cannot change what the next visitor sees.
    """
    template = db.scalar(select(User).where(User.email == DEMO_TEMPLATE_EMAIL))
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo data is not available. Run db/seed.py to populate it.",
        )

    guest = User(
        email=f"guest-{secrets.token_hex(8)}@carboniq.demo",
        # Unguessable and never returned: guest accounts are reachable only
        # through the token issued below, never through the login form.
        password_hash=hash_password(secrets.token_urlsafe(32)),
    )
    db.add(guest)
    db.flush()

    _clone_demo_data(db, template, guest)
    db.commit()
    db.refresh(guest)

    return _issue_token(guest)
