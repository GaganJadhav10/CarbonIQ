import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, projects as projectsApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { ColdStartNotice, EmptyState, ErrorNotice, SkeletonList, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';

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
        New project
      </button>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card__title">New project</h2>
      <p className="card__subtitle">A monitoring initiative that sites will be grouped under.</p>

      <div className="field">
        <label htmlFor="project-name">Name</label>
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
          placeholder="What is being monitored, and why."
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
          {isSubmitting ? 'Creatingâ€¦' : 'Create project'}
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

  return (
    <>
      <div className="page-heading page-heading--with-action">
        <div>
          <h1>Projects</h1>
          <p>Monitoring initiatives you own. Each groups one or more geographic sites.</p>
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

      {isSlow && state.kind === 'loading' && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ColdStartNotice />
        </div>
      )}

      {state.kind === 'loading' && <SkeletonList rows={3} />}

      {state.kind === 'error' && <ErrorNotice message={state.message} onRetry={load} />}

      {state.kind === 'ready' && state.projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create your first project, then add sites to it by drawing their boundaries on the map."
        />
      )}

      {state.kind === 'ready' && state.projects.length > 0 && (
        <ul className="project-grid">
          {state.projects.map((project) => (
            <li key={project.id}>
              <Link to={`/projects/${project.id}`} className="card project-card">
                <h2 className="card__title">{project.name}</h2>
                {project.description && (
                  <p className="project-card__description">{project.description}</p>
                )}
                <div className="project-card__meta">
                  <span className="pill">
                    {project.site_count} {project.site_count === 1 ? 'site' : 'sites'}
                  </span>
                  <span>Created {formatDate(project.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
