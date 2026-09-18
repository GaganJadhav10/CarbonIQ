import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, MapPin, ShieldCheck } from 'lucide-react';

import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { ColdStartNotice, Spinner } from './ui';

const MIN_PASSWORD_LENGTH = 8;

const HIGHLIGHTS = [
  { Icon: MapPin, text: 'Draw site boundaries directly on the map' },
  { Icon: BarChart3, text: 'Track carbon, canopy and biodiversity over time' },
  { Icon: ShieldCheck, text: 'Your projects are visible only to you' },
];

/**
 * Shared sign-in / sign-up screen.
 *
 * One component for both modes because the fields, validation and error
 * handling are identical -- only the copy and the submit action differ.
 *
 * The split layout exists so the screen explains what the product is. It was
 * previously a bare card on an empty background, which told a first-time
 * visitor nothing at all.
 */
export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const { signIn, signUp, startDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoStarting, setIsDemoStarting] = useState(false);
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

  async function runWithFeedback(action, setBusy) {
    setFormError(null);
    setBusy(true);
    const slowTimer = setTimeout(() => setIsSlow(true), 2200);

    try {
      await action();
      navigate('/projects', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Unexpected error. Please try again.'
      );
    } finally {
      clearTimeout(slowTimer);
      setIsSlow(false);
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    runWithFeedback(
      () => (isRegister ? signUp(email.trim(), password) : signIn(email.trim(), password)),
      setIsSubmitting
    );
  }

  const isBusy = isSubmitting || isDemoStarting;

  return (
    <div className="auth-layout">
      {/* Brand panel: hidden on narrow screens, where it would push the form
          below the fold rather than adding context. */}
      <aside className="auth-aside">
        <Link to="/" className="brand brand--inverse">
          <img className="brand__mark" src="/favicon.svg" alt="" />
          CarbonIQ
        </Link>

        <div className="auth-aside__body">
          <h2>Geospatial analytics for land restoration.</h2>
          <p>
            Manage carbon and biodiversity monitoring programmes — from project setup through to
            site-level performance over time.
          </p>

          <ul className="auth-aside__list">
            {HIGHLIGHTS.map(({ Icon, text }) => (
              <li key={text}>
                <Icon size={17} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-aside__footnote">Demo data is synthetic, not real measurement data.</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-card__back">
            <ArrowLeft size={15} aria-hidden="true" />
            Back
          </Link>

          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-card__lede">
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
                aria-describedby={
                  fieldErrors.password ? 'password-error' : isRegister ? 'password-hint' : undefined
                }
              />
              {isRegister && !fieldErrors.password && (
                <p className="field__hint" id="password-hint">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              )}
              {fieldErrors.password && (
                <p className="field__error" id="password-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {formError && (
              <div className="notice notice--error mt-4" role="alert">
                {formError}
              </div>
            )}

            {isSlow && isBusy && (
              <div className="mt-4">
                <ColdStartNotice />
              </div>
            )}

            <button
              type="submit"
              className="button button--primary button--block button--lg mt-5"
              disabled={isBusy}
            >
              {isSubmitting && <Spinner />}
              {isSubmitting ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-card__divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="button button--secondary button--block"
            onClick={() => runWithFeedback(startDemo, setIsDemoStarting)}
            disabled={isBusy}
          >
            {isDemoStarting && <Spinner />}
            {isDemoStarting ? 'Preparing your demo…' : 'Explore the demo instead'}
          </button>

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
      </main>
    </div>
  );
}
