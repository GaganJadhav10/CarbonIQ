/**
 * Thin fetch wrapper around the CarbonIQ API.
 *
 * The API is a separate origin (Render) from the app (Vercel), so every call
 * goes through here: one place that knows the base URL, attaches the JWT, and
 * normalises errors into a single ApiError shape.
 */

/**
 * Vite inlines VITE_* at build time, so this is a constant in the bundle rather
 * than something read at runtime. Changing it on Vercel requires a redeploy.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(
  /\/+$/,
  ''
);

/** How long a request may run before it is assumed to be a Render cold start. */
const COLD_START_THRESHOLD_MS = 2500;

/** An API call that completed with a non-2xx status, or failed to reach the API. */
export class ApiError extends Error {
  constructor(message, { status = null, body = null, isNetworkError = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Pull the most useful message out of an error response.
 *
 * FastAPI returns `{ detail: ... }`, where detail is a string for HTTPException
 * and an array of per-field objects for a validation failure.
 */
function extractErrorMessage(body, status) {
  const detail = body?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.at(-1) : null;
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join('; ');
  }

  return `Request failed with status ${status}.`;
}

/**
 * Call the API and return the parsed JSON body.
 *
 * @param {string} path                 Path beginning with `/`, e.g. `/api/health`.
 * @param {object} [options]
 * @param {string} [options.method]     HTTP method. Defaults to GET.
 * @param {object} [options.body]       Serialised as JSON when present.
 * @param {string} [options.token]      Bearer token for protected routes.
 * @param {AbortSignal} [options.signal]
 * @param {() => void} [options.onSlow] Called once if the request outlives
 *   COLD_START_THRESHOLD_MS, so the UI can explain a cold start rather than
 *   appearing frozen.
 * @returns {Promise<any>} Parsed response body, or null for a 204.
 * @throws {ApiError}
 */
export async function apiFetch(path, { method = 'GET', body, token, signal, onSlow } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const slowTimer = onSlow ? setTimeout(onSlow, COLD_START_THRESHOLD_MS) : null;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // fetch only rejects on network-level failures: DNS, TLS, a rejected CORS
    // preflight, or an abort. A 4xx/5xx resolves normally.
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the CarbonIQ API. Check your connection and that the API is running.',
      { isNetworkError: true }
    );
  } finally {
    if (slowTimer !== null) clearTimeout(slowTimer);
  }

  if (response.status === 204) return null;

  let payload = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), {
      status: response.status,
      body: payload,
    });
  }

  return payload;
}

// --- Endpoints ---------------------------------------------------------------

export const health = {
  get: (options) => apiFetch('/api/health', options),
};

export const auth = {
  register: (email, password, options) =>
    apiFetch('/api/auth/register', { method: 'POST', body: { email, password }, ...options }),

  login: (email, password, options) =>
    apiFetch('/api/auth/login', { method: 'POST', body: { email, password }, ...options }),

  me: (options) => apiFetch('/api/auth/me', options),

  /**
   * Provision a throwaway guest account preloaded with the demo dataset.
   *
   * Deliberately a server-side endpoint rather than logging in with demo
   * credentials embedded in this bundle: shipping a password as a string
   * literal in client code is a poor pattern even when the account is public.
   */
  demo: (options) => apiFetch('/api/auth/demo', { method: 'POST', ...options }),
};

export const projects = {
  list: (options) => apiFetch('/api/projects', options),

  create: (data, options) => apiFetch('/api/projects', { method: 'POST', body: data, ...options }),

  get: (id, options) => apiFetch(`/api/projects/${id}`, options),

  remove: (id, options) => apiFetch(`/api/projects/${id}`, { method: 'DELETE', ...options }),
};

export const sites = {
  list: (projectId, options) =>
    apiFetch(projectId ? `/api/sites?project_id=${projectId}` : '/api/sites', options),

  create: (data, options) => apiFetch('/api/sites', { method: 'POST', body: data, ...options }),

  get: (id, options) => apiFetch(`/api/sites/${id}`, options),

  remove: (id, options) => apiFetch(`/api/sites/${id}`, { method: 'DELETE', ...options }),

  metrics: (id, options) => apiFetch(`/api/sites/${id}/metrics`, options),
};

/** Exposed so the UI can show which API it is actually talking to. */
export { API_BASE_URL };
