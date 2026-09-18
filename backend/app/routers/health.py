"""Health check.

Deliberately goes all the way to the database rather than returning a static
"ok": the point of the check is to prove the Render -> Supabase link and the
PostGIS extension are both live, which is exactly what silently breaks first.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    """Report API, database, and PostGIS status.

    Returns 503 rather than a 200-with-an-error-field so that uptime monitors
    and Render's own health checks read the failure correctly.
    """
    settings = get_settings()

    try:
        postgis_version = db.execute(text("select postgis_version()")).scalar_one()
    except SQLAlchemyError as exc:
        logger.exception("Health check failed to reach the database")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unreachable or PostGIS extension not installed.",
        ) from exc

    return HealthResponse(
        status="ok",
        environment=settings.environment,
        database="connected",
        postgis_version=str(postgis_version),
    )
