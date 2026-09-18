"""FastAPI application factory and entrypoint.

The API is deployed standalone on Render; the React frontend is deployed
separately on Vercel and calls this service cross-origin with a bearer token.
That split is why CORS configuration below is load-bearing rather than
boilerplate -- see the README "Trade-offs" section.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, health, projects, sites
from app.schemas import ApiInfo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

settings = get_settings()

app = FastAPI(
    title="CarbonIQ API",
    description=(
        "Geospatial project and site analytics for carbon and biodiversity "
        "monitoring initiatives."
    ),
    version="0.1.0",
)

# allow_credentials stays False on purpose: the JWT travels in an Authorization
# header, not a cookie, so the browser never needs to send credentials and we
# avoid the SameSite/third-party-cookie problems a split deployment would
# otherwise inherit.
#
# allow_origin_regex covers Vercel preview deployments, whose subdomains are
# generated per branch and so cannot be listed ahead of time.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.vercel_preview_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(sites.router, prefix="/api")


@app.get("/", response_model=ApiInfo, tags=["health"])
def root() -> ApiInfo:
    """Landing payload, so the bare Render URL is informative rather than a 404."""
    return ApiInfo(name="CarbonIQ API", docs="/docs", health="/api/health")
