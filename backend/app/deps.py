"""Reusable FastAPI dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import InvalidTokenError, decode_access_token

# auto_error=False so a missing header produces our own 401 with a useful
# message, rather than FastAPI's bare 403.
bearer_scheme = HTTPBearer(auto_error=False, description="JWT issued by /api/auth/login")

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user, or reject the request with 401.

    Applied to every route that touches user-owned data. Returning the User row
    (rather than just an id) means downstream handlers can scope their queries
    to the owner without a second lookup.
    """
    if credentials is None or not credentials.credentials:
        raise UNAUTHORIZED

    try:
        user_id = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise UNAUTHORIZED from exc

    user = db.get(User, user_id)
    if user is None:
        # Valid signature, but the account has since been deleted.
        raise UNAUTHORIZED

    return user
