import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import './login.css';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(username.trim(), password.trim()); nav('/portal'); }
    catch (err) { setError(err.message || 'Invalid username or password.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="login-page">
        <div className="login-container">
          <div className="welcome-panel">
            <div className="welcome-content">
              <div className="eps-logo"><img src="/eps-logo.png" alt="Eastern Public School" /></div>
              <div className="welcome-small">Eastern Public School</div>
              <div className="welcome-title">Welcome</div>
              <div className="welcome-subtitle">PYP Academic Hub</div>
              <div className="welcome-line" />
              <div className="welcome-description">
                A central space for learning, assessment, reflection and student growth across the Primary Years Programme.
              </div>
            </div>
            <div className="circle-one" /><div className="circle-two" />
          </div>
          <div className="login-panel">
            <div className="login-heading">Sign in</div>
            <p className="login-subheading">Sign in with your school credentials</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit} autoComplete="off">
              <div className="form-group">
                <label className="form-label" htmlFor="username-field">Username</label>
                <input className="form-input" id="username-field" placeholder="Enter your username" required
                  autoCapitalize="off" autoCorrect="off" spellCheck="false" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password-field">Password</label>
                <div className="password-box">
                  <input className="form-input" id="password-field" type={show ? 'text' : 'password'} placeholder="Enter your password"
                    required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="password-toggle" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
                    {show ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
              <button type="submit" className="login-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
            </form>
            <div className="login-divider">Or</div>
            <p className="footer-note">Contact your school administrator if you forgot your login details.</p>
            <div className="login-footer">Eastern Public School · PYP Academic Hub</div>
          </div>
        </div>
      </div>
      <div className="developer-credit">Credit: Developer - Bushra Khan</div>
    </>
  );
}
