import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Field } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { staticMapUrl } from '../lib/static-map';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sign in and register — DESIGN.md §5.1.
 *
 * A 480 px form column beside a Mapbox Static Images satellite view of a real
 * landscape with its sample site polygons drawn on it. The product's own
 * subject matter is the decoration; the image is hidden below 900 px.
 */
export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { signIn, signUp, startDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  function validate() {
    const next = {};
    if (!email.trim()) next.email = 'Enter your email address';
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address';

    if (!password) next.password = 'Enter your password';
    else if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password needs at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function run(action, setBusy) {
    setFormError(null);
    setBusy(true);
    try {
      await action();
      navigate('/projects', { replace: true });
    } catch (error) {
      // §5.5: never say which of the two was wrong.
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    run(
      () => (isRegister ? signUp(email.trim(), password) : signIn(email.trim(), password)),
      setSubmitting
    );
  }

  const busy = submitting || demoLoading;

  return (
    <div className="auth">
      <div className="auth__form-col">
        <span className="app__name">CarbonIQ</span>

        <div className="stack">
          <h1 className="t-page-title">{isRegister ? 'Create an account' : 'Sign in'}</h1>

          <form className="stack" onSubmit={handleSubmit} noValidate>
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
            />

            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              // §5.1: the requirement is shown before any error occurs.
              help={isRegister ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined}
              error={errors.password}
            />

            {formError && (
              <p className="field__error" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" variant="primary" block loading={submitting}>
              {isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <div className="auth__divider">or</div>

          <Button
            variant="secondary"
            block
            loading={demoLoading}
            onClick={() => run(startDemo, setDemoLoading)}
            disabled={busy}
          >
            Explore sample data
          </Button>

          <p className="t-small muted">
            Opens a private workspace preloaded with three sample projects. Nothing you do there
            affects anyone else.
          </p>

          <p className="t-body">
            {isRegister ? (
              <>
                Already have an account? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                No account yet? <Link to="/register">Create an account</Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="auth__aside">
        <img
          className="auth__image"
          src={staticMapUrl()}
          alt="Satellite view of the Sundarbans delta with sample site boundaries drawn"
          loading="eager"
        />
        <p className="auth__caption">Sundarbans delta, 21.9400° N, 89.1800° E. Sample sites.</p>
      </div>
    </div>
  );
}
