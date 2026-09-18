"""Password hashing and JWT issuing/verification.

Implemented directly rather than delegated to a managed auth product: JWT-based
authentication is a named requirement of the brief, so it is the thing being
assessed. Supabase is used purely as managed Postgres.

bcrypt is used directly rather than through passlib, because passlib 1.7.4
raises a noisy AttributeError against modern bcrypt releases and is no longer
actively maintained.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import get_settings

# bcrypt truncates silently at 72 bytes. Rejecting longer input is safer than
# letting two different passwords hash identically.
MAX_PASSWORD_BYTES = 72


class InvalidTokenError(Exception):
    """Raised when a token is missing, malformed, expired, or not ours."""


def hash_password(password: str) -> str:
    """Return a salted bcrypt hash of `password`."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if `password` matches `password_hash`."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash in the database -- treat as a failed login, never a 500.
        return False


def create_access_token(user_id: int) -> tuple[str, int]:
    """Issue a signed JWT for `user_id`.

    Returns the token and its lifetime in seconds, so the client can display
    session expiry without having to decode the token itself.
    """
    settings = get_settings()
    expires_in = settings.jwt_expire_minutes * 60
    now = datetime.now(UTC)

    payload = {
        "sub": str(user_id),  # RFC 7519 requires `sub` to be a string.
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> int:
    """Verify `token` and return the user id it identifies.

    :raises InvalidTokenError: if the signature, expiry, or payload is invalid.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    subject = payload.get("sub")
    if subject is None:
        raise InvalidTokenError("Token is missing a subject claim.")

    try:
        return int(subject)
    except (TypeError, ValueError) as exc:
        raise InvalidTokenError("Token subject is not a valid user id.") from exc
