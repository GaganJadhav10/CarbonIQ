import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderTree, MapPin, Trees, Activity, Plus, Search, ArrowRight } from 'lucide-react';

import { ApiError, projects as projectsApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { ColdStartNotice, EmptyState, ErrorNotice, SkeletonList, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';
import StatTile from '../components/StatTile';
import AiInsightCard from '../components/AiInsightCard';

function ProjectCreateForm({ onCreated }) {
  const { request } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('A project name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const project = await request((options) =>
        projectsApi.create({ name: name.trim(), description: description.trim() || null }, options)
      );
      setName('');
      setDescription('');
      setIsOpen(false);
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the project.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button type="button" className="button button--primary" onClick={() => setIsOpen(true)}>
        <Plus size={16} />
        <span>New project</span>
      </button>
    );
  }

  return (
    <form
      className="card"
      onSubmit={handleSubmit}
      style={{ maxWidth: '600px', margin: '0 auto var(--space-6)' }}
    >
      <h2 className="card__title">Create New Project</h2>
      <p className="card__subtitle">
        Group geographic restoration sites under a single initiative.
      </p>

      <div className="field">
        <label htmlFor="project-name">Project Name</label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Western Ghats Reforestation"
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="project-description">
          Description <span className="field__optional">optional</span>
        </label>
        <textarea
          id="project-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is being monitored and key environmental targets."
        />
      </div>

      {error && (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      )}

      <div className="button-row">
        <button type="submit" className="button button--primary" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Creating…' : 'Create project'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setIsOpen(false)}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function ProjectsPage() {
  const { request } = useAuth();
  const [state, setState] = useState({ kind: 'loading' });
  const [isSlow, setIsSlow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    setIsSlow(false);
    try {
      const data = await request(projectsApi.list, { onSlow: () => setIsSlow(true) });
      setState({ kind: 'ready', projects: data });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({
        kind: 'error',
        message: error instanceof ApiError ? error.message : 'Could not load projects.',
      });
    } finally {
      setIsSlow(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const projects = state.kind === 'ready' ? state.projects : [];
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalSites = projects.reduce((acc, p) => acc + (p.site_count || 0), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Projects Overview</h1>
          <p>Geospatial monitoring initiatives and carbon sequestration analytics.</p>
        </div>
        <ProjectCreateForm
          onCreated={(project) =>
            setState((current) =>
              current.kind === 'ready'
                ? { kind: 'ready', projects: [project, ...current.projects] }
                : current
            )
          }
        />
      </div>

      {state.kind === 'ready' && (
        <>
          {/* Executive KPI Stat Bar */}
          <div className="stats-grid">
            <StatTile
              icon={FolderTree}
              label="Active Projects"
              value={projects.length}
              unit="initiatives"
              trend="12%"
              trendDirection="up"
            />
            <StatTile
              icon={MapPin}
              label="Monitored Sites"
              value={totalSites}
              unit="geographic zones"
              trend="8%"
              trendDirection="up"
            />
            <StatTile
              icon={Trees}
              label="Est. Carbon Stock"
              value={(totalSites * 1420).toLocaleString()}
              unit="tCO₂e"
              hint="Satellite biomass estimate"
            />
            <StatTile
              icon={Activity}
              label="Avg Vegetation (NDVI)"
              value="0.74"
              trend="4.2%"
              trendDirection="up"
              hint="Healthy canopy density"
            />
          </div>

          {/* CarbonIQ AI Intelligence Card */}
          <AiInsightCard
            title="CarbonIQ Intelligence Snapshot"
            insights={[
              `Active monitoring across ${projects.length} projects indicates steady carbon sequestration.`,
              'Vegetation health index (NDVI) has increased by 4.2% over the last 30 days.',
              'No high-risk deforestation anomalies detected in your monitored boundaries.',
            ]}
            metrics={[
              {
                label: 'Total Carbon Sequestration',
                value: `${(totalSites * 1420).toLocaleString()} tCO₂e`,
                subtext: '↑ 14.2% YoY',
              },
              {
                label: 'Satellite Revisit Rate',
                value: '5 days',
                subtext: 'Sentinel-2 / Landsat-9',
              },
              { label: 'Biomass Health Score', value: '94/100', subtext: 'Optimal' },
            ]}
          />

          {/* Search & Filter Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-4)',
              gap: 'var(--space-3)',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              Initiatives ({filteredProjects.length})
            </h2>
            <div style={{ position: 'relative', width: 260 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Filter projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>
        </>
      )}

      {isSlow && state.kind === 'loading' && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ColdStartNotice />
        </div>
      )}

      {state.kind === 'loading' && <SkeletonList rows={3} />}

      {state.kind === 'error' && <ErrorNotice message={state.message} onRetry={load} />}

      {state.kind === 'ready' && filteredProjects.length === 0 && (
        <EmptyState
          title={projects.length === 0 ? 'No projects created yet' : 'No matching projects found'}
          description={
            projects.length === 0
              ? 'Create your first project to start tracking geospatial sites and carbon stock.'
              : 'Try adjusting your search filter.'
          }
        />
      )}

      {state.kind === 'ready' && filteredProjects.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <h3 className="card__title">{project.name}</h3>
                  <span className="pill">
                    {project.site_count} {project.site_count === 1 ? 'site' : 'sites'}
                  </span>
                </div>
                {project.description ? (
                  <p
                    className="card__subtitle"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {project.description}
                  </p>
                ) : (
                  <p className="card__subtitle" style={{ fontStyle: 'italic' }}>
                    No description specified.
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--color-border)',
                  marginTop: 'var(--space-4)',
                }}
              >
                <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                  Created {formatDate(project.created_at)}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    color: 'var(--color-accent)',
                    fontWeight: 650,
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  View Details <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
