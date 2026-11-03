import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BrandAside } from './LoginPage';

/**
 * Registration page. Client-side checks give instant feedback; the server
 * re-validates everything (the source of truth) and returns per-field
 * errors that we map back onto the form.
 */
export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Please tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Please enter a valid email address.';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    setBusy(true);
    setAlert(null);
    setErrors({});
    try {
      await register(form.name, form.email, form.password);
      showToast('Account created — welcome to SprintBoard!');
      navigate('/', { replace: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      else setAlert(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <BrandAside />
      <div className="auth__form-wrap">
        <div className="auth__form">
          <h1 className="auth__form-title">Create your account</h1>
          <p className="auth__form-sub">Free, local, and ready in seconds.</p>

          {alert && <div className="alert"><AlertTriangle size={15} />{alert}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="reg-name">Name</label>
              <input
                id="reg-name"
                className={`input${errors.name ? ' input--invalid' : ''}`}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ada Lovelace"
                autoComplete="name"
                autoFocus
              />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                className={`input${errors.email ? ' input--invalid' : ''}`}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@company.com"
                autoComplete="email"
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                className={`input${errors.password ? ' input--invalid' : ''}`}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn--primary auth__submit" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth__switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
