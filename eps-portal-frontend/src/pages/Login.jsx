import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuthShell, { PasswordField } from './AuthShell.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.mustChange ? '/change-password' : '/portal'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(username.trim(), password.trim());
      nav(u.mustChange ? '/change-password' : '/portal');
    } catch (err) { setError(err.message || 'Invalid username or password.'); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <div className="login-heading">Sign in</div>
      <p className="login-subheading">Sign in with your school credentials</p>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit} autoComplete="off">
        <div className="form-group">
          <label className="form-label" htmlFor="username-field">Username</label>
          <input className="form-input" id="username-field" placeholder="Enter your username" required
            autoCapitalize="off" autoCorrect="off" spellCheck="false" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <PasswordField id="password-field" label="Password" placeholder="Enter your password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div style={{ textAlign: 'right', margin: '-4px 0 14px' }}>
          <Link to="/forgot-password" style={{ fontSize: '.82rem', fontWeight: 600 }}>Forgot password?</Link>
        </div>
        <button type="submit" className="login-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
      </form>
      <div className="login-divider">Or</div>
      <p className="footer-note">Forgot your username? Contact your school administrator.</p>
    </AuthShell>
  );
}
