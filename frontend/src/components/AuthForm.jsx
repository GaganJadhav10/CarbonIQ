import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { ColdStartNotice, Spinner } from './ui';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Shared sign-in / sign-up form.
 *
 * One component for both modes because the fields, validation, and error
 * handling are identical -- only the copy and the submit action differ.
 */
export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSlow, setIsSlow] = useState(false);

  function validate() {
    const errors = {};
    if (!email.trim()) errors.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address.';

    if (!password) errors.password = 'Password is required.';
    else if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    const slowTimer = setTimeout(() => setIsSlow(true), 2500);

    try {
      await (isRegister ? signUp(email.trim(), password) : signIn(email.trim(), password));
      navigate('/projects', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Unexpected error. Please try again.'
      );
    } finally {
      clearTimeout(slowTimer);
      setIsSlow(false);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="card auth-card">
        <h1 className="card__title">{isRegister ? 'Create an account' : 'Sign in'}</h1>
        <p className="card__subtitle">
          {isRegister
            ? 'Set up an administrator account to manage projects and sites.'
            : 'Sign in to manage your monitoring projects.'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p className="field__error" id="email-error">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p className="field__error" id="password-error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {formError && (
            <div
              className="notice notice--error"
              role="alert"
              style={{ marginTop: 'var(--space-4)' }}
            >
              {formError}
            </div>
          )}

          {isSlow && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <ColdStartNotice />
            </div>
          )}

          <button
            type="submit"
            className="button button--primary button--block"
            style={{ marginTop: 'var(--space-5)' }}
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Workingâ€¦' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-card__switch">
          {isRegister ? (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          ) : (
            <>
              No account yet? <Link to="/register">Create one</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
