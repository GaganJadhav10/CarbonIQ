import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MapCanvas from '../components/MapCanvas';
import {
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  Segmented,
  SkeletonRows,
  Chip,
} from '../components/ui';
import { ApiError, projects as projectsApi, sites as sitesApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { formatArea, formatRelative } from '../lib/format';
import { useToast } from '../lib/toast-context';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'carbon', label: 'Carbon' },
  { value: 'biodiversity', label: 'Biodiversity' },
];

const TYPE_LABELS = { carbon: 'Carbon', biodiversity: 'Biodiversity', both: 'Both' };

function CreateProjectDialog({ open, onClose, onCreated }) {
  const { request } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('carbon');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setName('');
    setDescription('');
    setProjectType('carbon');
    setError(null);
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Enter a project name');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const project = await request((options) =>
        projectsApi.create(
          {
            name: name.trim(),
            description: description.trim() || null,
            project_type: projectType,
          },
          options
        )
      );
      onCreated(project);
      // §10: the toast uses the same verb as the action.
      toast.success('Project created');
      close();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Create project">
      <form className="stack" onSubmit={handleSubmit}>
        <Field
          id="project-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error && !name.trim() ? error : undefined}
        />

        <Field
          id="project-description"
          as="textarea"
          label="Description"
          help="Optional"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="field">
          <span className="field__label">Type</span>
          <Segmented
            label="Project type"
            value={projectType}
            onChange={setProjectType}
            options={[
              { value: 'carbon', label: 'Carbon' },
              { value: 'biodiversity', label: 'Biodiversity' },
              { value: 'both', label: 'Both' },
            ]}
          />
        </div>

        {error && name.trim() && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}

        <div className="row">
          <Button type="submit" variant="primary" loading={submitting}>
            Create project
          </Button>
          <Button type="button" variant="quiet" onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Projects — DESIGN.md §5.2.
 *
 * A ledger beside an overview map. Deliberately no summary stat tiles: the row
 * count is the summary, and a tile restating it is decoration (§5.2, §12).
 *
 * Hovering a row highlights that project's polygons, which is the first half of
 * the ledger-and-map link described in §2.
 */
export default function ProjectsPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const [state, setState] = useState({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [projects, collection] = await Promise.all([
        request(projectsApi.list),
        request((options) => sitesApi.list(null, options)),
      ]);
      setState({ kind: 'ready', projects, collection });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({
        kind: 'error',
        message:
          error instanceof ApiError
            ? "Couldn't load projects. Check your connection and try again."
            : 'Something went wrong.',
      });
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  // Memoised so the filter below does not see a new array identity on every
  // render and recompute needlessly.
  const projects = useMemo(() => (state.kind === 'ready' ? state.projects : []), [state]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesType =
        typeFilter === 'all' ||
        project.project_type === typeFilter ||
        project.project_type === 'both';
      const matchesQuery =
        !needle ||
        project.name.toLowerCase().includes(needle) ||
        (project.description ?? '').toLowerCase().includes(needle);
      return matchesType && matchesQuery;
    });
  }, [projects, query, typeFilter]);

  /** Highlight every polygon belonging to a project as its row is hovered. */
  function highlightProject(projectId) {
    if (state.kind !== 'ready') return;
    for (const feature of state.collection.features) {
      mapRef.current?.highlightSite(
        feature.properties.project_id === projectId ? feature.id : null
      );
    }
  }

  return (
    <>
      <section className="panel">
        <div className="panel__head stack stack--tight">
          <div className="row row--between">
            <h1 className="t-panel-title">Projects</h1>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              Create project
            </Button>
          </div>

          <input
            className="field__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />

          <Segmented
            label="Project type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={TYPE_FILTERS}
          />
        </div>

        <div className="panel__scroll">
          {state.kind === 'loading' && <SkeletonRows rows={6} />}

          {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={load} />}

          {state.kind === 'ready' && projects.length === 0 && (
            <EmptyState
              message="No projects yet. Create a project to start mapping sites."
              action={
                <Button variant="primary" onClick={() => setDialogOpen(true)}>
                  Create project
                </Button>
              }
            />
          )}

          {state.kind === 'ready' && projects.length > 0 && visible.length === 0 && (
            <EmptyState message="No projects match that search." />
          )}

          {state.kind === 'ready' && visible.length > 0 && (
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Sites</th>
                  <th scope="col">Area</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((project) => (
                  <tr
                    key={project.id}
                    onMouseEnter={() => highlightProject(project.id)}
                    onMouseLeave={() => highlightProject(null)}
                  >
                    <td>
                      <a
                        className="ledger__link"
                        href={`/projects/${project.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`/projects/${project.id}`);
                        }}
                        onFocus={() => highlightProject(project.id)}
                        onBlur={() => highlightProject(null)}
                      >
                        <span className="grow">
                          <span className="ledger__name">{project.name}</span>
                          {project.description && (
                            <span className="ledger__sub">{project.description}</span>
                          )}
                        </span>
                        <Chip>{TYPE_LABELS[project.project_type]}</Chip>
                      </a>
                    </td>
                    <td className="ledger__num">{project.site_count}</td>
                    <td className="ledger__num">{formatArea(project.total_area_hectares)}</td>
                    <td className="ledger__num muted">{formatRelative(project.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <MapCanvas
        ref={mapRef}
        collection={state.kind === 'ready' ? state.collection : null}
        onSelect={(siteId) => {
          const feature =
            state.kind === 'ready' ? state.collection.features.find((f) => f.id === siteId) : null;
          if (feature) navigate(`/projects/${feature.properties.project_id}?site=${siteId}`);
        }}
      />

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(project) =>
          setState((current) =>
            current.kind === 'ready'
              ? { ...current, projects: [project, ...current.projects] }
              : current
          )
        }
      />
    </>
  );
}
