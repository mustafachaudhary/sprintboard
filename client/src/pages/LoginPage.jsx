import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Logo from '../components/Logo';

/**
 * Shared brand panel for the login/register screens.
 * Flat composition on the product's own ground: the board motif drawn
 * large (the logo's bars, enlarged), the words doing the persuading.
 * Hidden on small screens.
 */
function BrandAside() {
  return (
    <aside className="auth__aside">
      <div className="auth__brand">
        <Logo size={32} />
        <span className="auth__brand-name">SprintBoard</span>
      </div>

      {/* The product's mark, enlarged: three columns of moving work */}
      <div className="auth__motif" aria-hidden="true">
        <span style={{ height: '150px', background: '#2DD4BF' }} />
        <span style={{ height: '96px', background: '#8FE8DC' }} />
        <span style={{ height: '58px', background: '#1FA594' }} />
      </div>

      <div className="auth__pitch">
        <h1 className="auth__pitch-title">Plan the work. Work the plan.</h1>
        <p className="auth__pitch-text">
          SprintBoard is a focused project tracker: organise projects, run
          them across a Kanban board, and keep every deadline in view.
        </p>
        <div className="auth__points">
          <div className="auth__point">
            <CheckCircle2 size={16} />
            Kanban boards with drag-and-drop and a keyboard-friendly fallback
          </div>
          <div className="auth__point">
            <CheckCircle2 size={16} />
            Deadlines, priorities and overdue tracking at a glance
          </div>
          <div className="auth__point">
            <CheckCircle2 size={16} />
            Your data stays yours: every project is private to your account
          </div>
        </div>
      </div>

      <div className="auth__foot">© {new Date().getFullYear()} SprintBoard, a portfolio project.</div>
    </aside>
  );
}

export { BrandAside };

/**
 * Login page. On success the user is sent to where they were heading
 * (route state `from`) or to the dashboard.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setAlert(null);
    setErrors({});
    try {
      await login(form.email, form.password);
      showToast('Welcome back!');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      else setAlert(err.message);
      setBusy(false);
    }
  }

  async function fillDemo() {
    setForm({ email: 'demo@sprintboard.app', password: 'demo1234' });
    setAlert(null);
    setErrors({});
    try {
      await login('demo@sprintboard.app', 'demo1234');
      showToast('Signed in to the demo workspace');
      navigate('/', { replace: true });
    } catch (err) {
      setAlert(err.message);
    }
  }

  return (
    <div className="auth">
      <BrandAside />
      <div className="auth__form-wrap">
        <div className="auth__form">
          <h2 className="auth__form-title">Welcome back</h2>
          <p className="auth__form-sub">Log in to pick up where your sprints left off.</p>

          {alert && (
            <div className="alert">
              <Info size={15} />
              {alert}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className={`input${errors.email ? ' input--invalid' : ''}`}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className={`input${errors.password ? ' input--invalid' : ''}`}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn--primary auth__submit" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <div className="demo-hint">
            <Info size={15} />
            <div>
              Just exploring? Use the demo account (demo-only, data resets on reseed).{' '}
              <button type="button" onClick={fillDemo} disabled={busy}>
                Sign in as Demo User
              </button>
            </div>
          </div>

          <p className="auth__switch">
            New to SprintBoard? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
