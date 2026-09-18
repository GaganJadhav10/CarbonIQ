# CarbonIQ

Geospatial project and site analytics for carbon and biodiversity monitoring initiatives.

An authenticated administrator creates **projects**, adds **sites** by drawing polygon boundaries on
an interactive map, and clicks into any site to see its measured performance charted over time.

|                            |                                            |
| -------------------------- | ------------------------------------------ |
| **Live demo**              | _(Vercel URL)_                             |
| **API + interactive docs** | _(Render URL)_ `/docs`                     |
| **Demo login**             | `demo@carboniq.app` / `carboniq-demo-2024` |

> **First load may take up to a minute.** The API runs on Render's free tier, which sleeps after
> ~15 minutes of inactivity. The UI shows an explicit "waking up the API" state rather than
> appearing frozen. Subsequent requests are fast.

---

## 1. Architecture

Three independently deployed services:

```
                  ┌────────────────────────────┐
   Browser ──────▶│  VERCEL — React 19 + Vite  │   the demo URL
                  │  Mapbox GL JS · Chart.js   │
                  └─────────────┬──────────────┘
                                │  fetch(VITE_API_BASE_URL + "/api/…")
                                │  Authorization: Bearer <JWT>   [CORS]
                                ▼
                  ┌────────────────────────────┐
                  │  RENDER — FastAPI (Python) │   + OpenAPI docs at /docs
                  │  auth · projects · sites   │
                  └─────────────┬──────────────┘
                                │  SQLAlchemy 2.0 (sync, psycopg2)
                                ▼
                  ┌────────────────────────────┐
                  │  SUPABASE — PostgreSQL 15  │
                  │  + PostGIS 3.3             │
                  └────────────────────────────┘
```

### Request flow, end to end

1. The React app reads a JWT from `sessionStorage` and attaches it to every call through a single
   fetch wrapper (`frontend/src/lib/api.js`).
2. FastAPI's `get_current_user` dependency (`backend/app/deps.py`) verifies the signature and
   resolves the user, or returns 401.
3. Route handlers scope every query to `current_user.id`, so ownership is enforced in the query
   itself rather than by a check that could be forgotten.
4. Geometry is converted by PostGIS — `ST_GeomFromGeoJSON` inbound, `ST_AsGeoJSON` outbound — and
   returned as a GeoJSON `FeatureCollection` that Mapbox consumes directly.

### Project layout

```
backend/app/
  main.py          FastAPI app, CORS configuration, router registration
  config.py        Typed settings (pydantic-settings), env + .env
  database.py      Engine, session factory, get_db dependency
  models.py        SQLAlchemy ORM models, incl. the PostGIS geometry column
  schemas.py       Pydantic request/response contracts, GeoJSON validation
  security.py      bcrypt hashing, JWT issuing and verification
  deps.py          get_current_user (the auth gate)
  routers/         health · auth · projects · sites
backend/tests/     pytest suite, runs against real PostGIS
db/
  schema.sql       Source of truth for the database structure
  apply_schema.py  Idempotent schema runner
  seed.py          Synthetic demo data generator
frontend/src/
  components/      MapView, MetricsChart, AuthForm, AppShell, ui primitives
  pages/           Projects, ProjectDetail, Map, SiteDetail
  lib/             api.js (fetch wrapper), auth.jsx (session), format, metrics
  styles/          index.css (design tokens) + components.css
```

---

## 2. Database schema

`db/schema.sql` is the single source of truth. It is idempotent and safe to re-run.

### `users`

| Column          | Type                   | Notes                             |
| --------------- | ---------------------- | --------------------------------- |
| `id`            | `serial` PK            |                                   |
| `email`         | `text` unique not null | Stored lowercased                 |
| `password_hash` | `text` not null        | bcrypt, never returned by the API |
| `created_at`    | `timestamptz`          |                                   |

### `projects`

| Column        | Type                    | Notes               |
| ------------- | ----------------------- | ------------------- |
| `id`          | `serial` PK             |                     |
| `owner_id`    | `integer` → `users(id)` | `on delete cascade` |
| `name`        | `text` not null         |                     |
| `description` | `text`                  |                     |
| `created_at`  | `timestamptz`           |                     |

### `sites`

| Column       | Type                       | Notes               |
| ------------ | -------------------------- | ------------------- |
| `id`         | `serial` PK                |                     |
| `project_id` | `integer` → `projects(id)` | `on delete cascade` |
| `name`       | `text` not null            |                     |
| `boundary`   | `geometry(Polygon, 4326)`  | The drawn polygon   |
| `created_at` | `timestamptz`              |                     |

`boundary` is stored in **EPSG:4326 (WGS 84 lon/lat)** — the coordinate system GeoJSON and Mapbox
GL JS both use natively — so the polygon is never reprojected anywhere in the round trip. A **GiST
index** (`sites_boundary_gix`) covers the geometry column: unnecessary at demo volumes, but it is
the correct schema for the bounding-box and intersection queries this dashboard would grow into.

### `site_metrics`

| Column        | Type                    | Notes                     |
| ------------- | ----------------------- | ------------------------- |
| `id`          | `serial` PK             |                           |
| `site_id`     | `integer` → `sites(id)` | `on delete cascade`       |
| `metric_name` | `text` not null         | e.g. `carbon_sequestered` |
| `value`       | `numeric` not null      |                           |
| `unit`        | `text`                  | e.g. `tCO2e`              |
| `recorded_at` | `date` not null         |                           |

Deliberately **generic key/value-per-date** rather than a fixed column per metric, so adding a new
metric type is an `INSERT` and not a migration. A composite index on
`(site_id, metric_name, recorded_at)` matches the dominant access pattern — "the history of one
metric for one site, in date order" — which is exactly what the chart endpoint asks for. A unique
index on the same triple enforces one observation per metric per site per date.

**Trade-off:** this gives up per-metric type safety and column-level constraints in the database.
For a dashboard whose metric set is expected to grow, schema flexibility is worth more; validation
happens in Pydantic instead.

---

## 3. Data provenance

**All demo data is synthetic.** No real measurement data is used, and none of the figures should be
read as real observations.

The brief permits synthetic or public datasets provided the choice is documented. Synthetic data is
the right call here for two reasons: the demo polygons are arbitrary areas that no real monitoring
programme has published figures for, and a generated series can be shaped to exercise the charting
layer properly — three metrics, 24 monthly observations each, a visible trend plus bounded noise —
in a way a sparse real extract would not.

`db/seed.py` generates each series as a linear trend plus bounded random noise, from a **fixed RNG
seed**, so the demo renders identically on every machine and re-seeding never silently changes the
charts. Percentages are clamped to 0–100 and counts to non-negative, so the noise reads as
measurement variance rather than corrupt data.

The site polygons are rough rectangles over real protected areas in India (Western Ghats,
Sundarbans, Nilgiris), chosen only so the map opens somewhere plausible. **They are not official
boundaries.**

---

## 4. Local setup

**Prerequisites:** Node 20+, Python 3.11+, and a PostgreSQL database with PostGIS (a free Supabase
project is the quickest route).

### 1. Database

In the Supabase SQL Editor: `create extension if not exists postgis;`

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # then fill in the values
```

`backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
JWT_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(48))">
FRONTEND_ORIGIN=http://localhost:5173
```

Two details that cause most setup failures:

- Use Supabase's **Session pooler** URI (port 5432), not the direct connection — the direct host is
  IPv6-only on the free tier and unreachable from Render.
- **Percent-encode reserved characters in the password**, since the whole value is a URI:
  `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`.

Then, from the repository root:

```bash
python db/apply_schema.py       # create tables, extension, indexes
python db/seed.py               # optional: demo projects, sites, 24 months of metrics
cd backend && uvicorn app.main:app --reload
```

API at http://localhost:8000, interactive docs at http://localhost:8000/docs.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local      # then fill in the values
npm run dev
```

`frontend/.env.local`:

```
VITE_MAPBOX_TOKEN=pk.<your Mapbox public token>
VITE_API_BASE_URL=http://localhost:8000
```

App at http://localhost:5173.

> `VITE_*` values are **inlined at build time**, not read at runtime. Changing either one requires a
> rebuild locally and a **redeploy** on Vercel — saving the new value alone does nothing.

### 4. Repository tooling

```bash
npm install                     # at the repository root: installs Husky + lint-staged
```

This registers the pre-commit hook. Run it once after cloning, before your first commit.

### Running the checks

```bash
pytest                          # backend suite (needs a PostGIS database)
ruff check . && black --check . # Python lint + format
cd frontend && npm run lint && npm run build
```

---

## 5. CI/CD pipeline

### 5.1 Pre-commit hooks (Husky + lint-staged)

Husky installs a Git `pre-commit` hook that runs `lint-staged`, which applies tools **only to
staged files** — fast enough that it never becomes something people bypass.

`.lintstagedrc.json`:

| Pattern                    | Commands                                |
| -------------------------- | --------------------------------------- |
| `frontend/**/*.{js,jsx}`   | `eslint --fix`, then `prettier --write` |
| `*.py`                     | `ruff check --fix`, then `black`        |
| `*.{json,css,md,yml,yaml}` | `prettier --write`                      |

Because the backend is Python, the hook needs tools that live in the virtualenv. Git hooks run in a
bare shell that has not activated it, so `.husky/pre-commit` puts the venv's script directory on
`PATH` first, handling both Windows (`Scripts/`) and POSIX (`bin/`) layouts:

```sh
if [ -d "backend/.venv/Scripts" ]; then
  PATH="$PWD/backend/.venv/Scripts:$PATH"
elif [ -d "backend/.venv/bin" ]; then
  PATH="$PWD/backend/.venv/bin:$PATH"
fi
export PATH

npx lint-staged
```

A root-level `package.json` existing purely for hook management alongside a Python backend is a
normal monorepo pattern, not a sign that the backend is JavaScript.

If a file cannot be auto-fixed — a genuine lint error rather than a formatting issue — `lint-staged`
exits non-zero and **the commit is blocked**.

### 5.2 GitHub Actions (`.github/workflows/ci.yml`)

Runs on every push to any branch and every pull request into `main`. A `concurrency` group cancels
a superseded in-flight run, so feedback always describes the latest commit.

Two jobs run **in parallel**, so a Python-only change still gets frontend feedback and neither job
can mask the other's failure.

**Job 1 — `frontend`**

| Step                                         | Purpose                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `actions/setup-node@v4` (Node 22, npm cache) | Cache keyed on both lockfiles                                                                                                 |
| `npm ci` (root)                              | Installs Prettier, shared with the pre-commit hook                                                                            |
| `npm ci` (frontend)                          | Application dependencies                                                                                                      |
| `npm run format:check`                       | Same Prettier config the hook enforces — CI and local cannot drift                                                            |
| `npm run lint`                               | ESLint 10 flat config                                                                                                         |
| `npm run build`                              | A production build catches what linting cannot: bad imports, failed module resolution, anything that only breaks under Rollup |

The build step supplies placeholder `VITE_*` values. Nothing in a build talks to a live service; the
real values live in Vercel.

**Job 2 — `backend`**

This job attaches a **PostGIS service container** (`postgis/postgis:16-3.4`) with a `pg_isready`
health check, and points `DATABASE_URL` at it:

| Step                                          | Purpose                                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions/setup-python@v5` (3.11, pip cache)   |                                                                                                                                                           |
| `pip install -r backend/requirements-dev.txt` |                                                                                                                                                           |
| `ruff check .`                                | Lint                                                                                                                                                      |
| `black --check .`                             | Format check (fails, never rewrites, in CI)                                                                                                               |
| `python db/apply_schema.py`                   | Applies **the same `schema.sql`** used against Supabase, so an invalid schema fails here with a clear error rather than as a confusing test failure later |
| `pytest -v`                                   | Full API suite                                                                                                                                            |

Two deliberate choices worth stating:

- **Tests run against real PostGIS, not mocks.** The behaviour under test _is_ PostGIS behaviour: a
  mocked session cannot demonstrate that a polygon survives a round trip unchanged.
- **CI never touches Supabase.** The container is created and destroyed per run, so tests cannot
  corrupt demo data and a failed run leaves nothing behind.

### 5.3 Deployment

|                | Vercel                                   | Render                                             |
| -------------- | ---------------------------------------- | -------------------------------------------------- |
| Serves         | React static build                       | FastAPI                                            |
| Root directory | `frontend`                               | `backend`                                          |
| Build          | `npm run build` (Vite preset)            | `pip install -r requirements.txt`                  |
| Start          | — (static)                               | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Env vars       | `VITE_MAPBOX_TOKEN`, `VITE_API_BASE_URL` | `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`    |

Render's configuration is committed as `render.yaml` (a Blueprint), so the service definition is
version-controlled rather than existing only as dashboard state. Secrets are marked `sync: false`
and entered in the dashboard.

`frontend/vercel.json` rewrites all non-asset paths to `/index.html`; without it, refreshing on a
client-side route such as `/projects/3` returns a 404 from Vercel's static host.

**First-deploy ordering matters,** because each service needs the other's URL:

1. Deploy Render → copy the `onrender.com` URL.
2. Deploy Vercel with `VITE_API_BASE_URL` set to that URL → copy the `vercel.app` URL.
3. Set `FRONTEND_ORIGIN` on Render to the Vercel URL → redeploy Render.

---

## 6. Trade-offs and decisions

Each of these was a real choice with a real alternative.

### Split deployment instead of one combined service

The frontend could have been built into the FastAPI image and served same-origin, which would avoid
CORS entirely. Deploying separately means the React bundle is served from Vercel's CDN, and the API
redeploys without touching the frontend. The cost is a CORS surface and two env-var dashboards to
keep pointed at each other — which is why §5.3 documents that relationship explicitly.

### FastAPI over Flask/Django

Pydantic gives request and response validation for free, and the auto-generated OpenAPI docs at
`/docs` let a reviewer exercise the whole API without writing a single curl command. Django would
have brought an admin and an ORM but far more framework than this surface needs.

### Chart.js over Highcharts

Both are permitted. Chart.js is fully open source; Highcharts requires a commercial licence for
anything beyond personal use. Taking on a licensing question in a work sample reviewed by the
company that would have to answer it is a needless risk.

### Synchronous SQLAlchemy, not async

FastAPI is an async framework, so async database access is the obvious-looking choice. It is the
wrong one here: `asyncpg` against Supabase's PgBouncer pooler hits prepared-statement conflicts that
need fragile workarounds. Starlette runs synchronous `def` endpoints in a threadpool, so the event
loop is never blocked, and the driver behaves predictably. The obvious choice would have cost hours
to no benefit at this scale.

### Geometry conversion in PostGIS, not Python

`ST_GeomFromGeoJSON` and `ST_AsGeoJSON` keep a single authority for coordinate handling and avoid
adding a Shapely/GEOS native dependency to the deployment. Area is computed by casting to
`geography` before `ST_Area`, which gives true geodesic square metres rather than meaningless
squared degrees.

### `schema.sql` instead of Alembic

The brief prescribes a schema file, and a reviewer reads one file instead of reconstructing state
from a migration chain. Alembic becomes the right answer the moment there is production data to
preserve across a schema change — it is not yet.

### PyJWT over python-jose, bcrypt over passlib

The FastAPI tutorial uses `python-jose` and `passlib`; both are effectively unmaintained, and
passlib 1.7.4 raises a noisy `AttributeError` against modern bcrypt releases. `PyJWT` and `bcrypt`
are each a few lines more to wire up and are actively maintained.

### JWT in `sessionStorage`, not `localStorage` or a cookie

`sessionStorage` is still readable by any script on the page, so it is not XSS-proof — but its
lifetime is bounded by the tab, so an abandoned session on a shared machine does not survive.
A `httpOnly` cookie would be stronger, but with the API on a different origin that means
third-party cookies and CSRF handling, which is disproportionate here. The token is also validated
against `/api/auth/me` on load, so an expired session never renders a signed-in shell.

### Authentication built in-house, not delegated to Supabase Auth

Supabase Auth would have been faster. But JWT authentication is a named requirement, so delegating
it would mean skipping the thing being assessed. Supabase is used purely as managed
Postgres + PostGIS.

### 404 rather than 403 for another user's resources

Returning 403 would confirm that a given project id exists. Every ownership check returns 404, so
identifiers cannot be enumerated.

### No zero-baseline on the charts

A restoration trend from 120 to 320 tCO2e is the story; forcing the y-axis to zero would flatten it
into a barely visible slope. Axis titles carry units so the scale is never ambiguous.

---

## 7. Known limitations

- **Render free-tier cold starts** (~50s after idle). Surfaced honestly in the UI rather than hidden.
- **Supabase free tier pauses** after ~7 days of inactivity and needs waking from the dashboard.
- The **Mapbox token is public by design** and visible in the built bundle. It is restricted by URL
  in the Mapbox dashboard, which is the intended control for a `pk.` token.
- Sites support **single polygons**, not multi-polygons or holes. The column type is
  `geometry(Polygon, 4326)`; widening it to `MultiPolygon` would be a one-line schema change.
- **No pagination** on project and site lists. Correct at demo scale, and the indexes to support it
  already exist.
