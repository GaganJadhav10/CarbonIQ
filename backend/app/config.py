"""Application configuration, loaded from the environment.

Settings are read from real environment variables first (how Render supplies
them) and fall back to backend/.env for local development.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Typed application settings.

    Anything without a default is required: the app fails loudly at startup
    rather than surfacing a confusing error on the first request.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str
    jwt_secret: str

    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    frontend_origin: str = "http://localhost:5173"
    vercel_preview_origin_regex: str | None = None

    environment: str = "development"

    @field_validator("vercel_preview_origin_regex", mode="after")
    @classmethod
    def blank_regex_means_unset(cls, value: str | None) -> str | None:
        """Treat an empty value as absent.

        Render supplies declared-but-unfilled variables as empty strings. Left
        as "", it would reach Starlette as a real regex that matches nothing --
        harmless, but it hides the fact that preview origins are unconfigured.
        """
        return value or None

    @property
    def cors_origins(self) -> list[str]:
        """Exact origins allowed to call the API.

        Always includes the local Vite dev server so that development exercises
        the same cross-origin code path as production -- a CORS mistake then
        shows up on localhost instead of after a deploy.
        """
        origins = {
            self.frontend_origin,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        }
        return sorted(origin for origin in origins if origin)


@lru_cache
def get_settings() -> Settings:
    """Return the singleton settings instance.

    Cached so the .env file is parsed once per process rather than per request.
    """
    return Settings()
