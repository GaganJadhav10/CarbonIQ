-- =============================================================================
-- CarbonIQ -- database schema
--
-- Single source of truth for the database structure. Apply with:
--     python db/apply_schema.py
-- or by pasting into the Supabase SQL Editor.
--
-- The script is idempotent: it can be re-run against an existing database
-- without error. It does NOT drop anything.
-- =============================================================================

create extension if not exists postgis;

-- -----------------------------------------------------------------------------
-- users -- application-managed accounts.
--
-- Authentication is implemented in this codebase (bcrypt + JWT) rather than
-- delegated to Supabase Auth: Supabase is used purely as managed Postgres.
-- -----------------------------------------------------------------------------
create table if not exists users (
    id            serial primary key,
    email         text unique not null,
    password_hash text not null,
    created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- projects -- a monitoring initiative owned by one user.
-- -----------------------------------------------------------------------------
create table if not exists projects (
    id          serial primary key,
    owner_id    integer not null references users (id) on delete cascade,
    name        text not null,
    description text,
    created_at  timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on projects (owner_id);

-- -----------------------------------------------------------------------------
-- sites -- a geographic area within a project, drawn as a polygon on the map.
--
-- `boundary` is a PostGIS polygon in EPSG:4326 (WGS 84 lon/lat), which is the
-- coordinate system GeoJSON and Mapbox GL JS both use natively. Storing it in
-- 4326 means no reprojection anywhere in the round trip.
-- -----------------------------------------------------------------------------
create table if not exists sites (
    id         serial primary key,
    project_id integer not null references projects (id) on delete cascade,
    name       text not null,
    boundary   geometry (Polygon, 4326) not null,
    created_at timestamptz not null default now()
);

create index if not exists sites_project_id_idx on sites (project_id);

-- GiST index on the geometry column: the standard spatial index type. Not
-- strictly needed at demo data volumes, but it is the correct schema for any
-- bounding-box or intersection query the dashboard would grow into.
create index if not exists sites_boundary_gix on sites using gist (boundary);

-- -----------------------------------------------------------------------------
-- site_metrics -- time-series observations, one row per (site, metric, date).
--
-- Deliberately generic: `metric_name` + `value` rather than a fixed column per
-- metric. Adding a new metric type is an INSERT, not a migration, which keeps
-- the charting layer working for any seeded dataset.
--
-- Trade-off: this gives up per-metric type safety and column-level constraints
-- at the database layer. For a dashboard whose metric set is expected to grow,
-- schema flexibility is worth more than that; validation happens in Pydantic.
-- -----------------------------------------------------------------------------
create table if not exists site_metrics (
    id          serial primary key,
    site_id     integer not null references sites (id) on delete cascade,
    metric_name text not null,
    value       numeric not null,
    unit        text,
    recorded_at date not null
);

-- Composite index matching the dominant access pattern: "give me the history of
-- one metric for one site, in date order" -- exactly what the chart endpoint asks.
create index if not exists site_metrics_site_metric_date_idx
    on site_metrics (site_id, metric_name, recorded_at);

-- One observation per metric per site per date.
create unique index if not exists site_metrics_unique_observation_idx
    on site_metrics (site_id, metric_name, recorded_at);
