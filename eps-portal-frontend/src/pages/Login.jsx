import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BASE } from '../api.js';
import { useAuth } from '../auth.jsx';
import AuthShell, { PasswordField } from './AuthShell.jsx';

const ERRORS = {
  not_added: 'Your account has not been added yet. Please contact your school administrator.',
  not_school_account: 'Please use your school Google account.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in did not work. Please try again.',
  google_off: 'Google sign-in is not available right now.',
};

// Two ways in, with the same school address: Google, or email and password.
export default function Login() {
  const { user, login, options } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(ERRORS[params.get('error')] || (params.get('error') ? ERRORS.google_failed : ''));
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.mustChange ? '/change-password' : '/portal'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(email.trim(), password.trim());
      nav(u.mustChange ? '/change-password' : '/portal');
    } catch (err) { setError(err.message || 'Invalid email or password.'); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <div className="login-heading">Sign in</div>
      <p className="login-subheading">Use your school email address</p>
      {error && <div className="alert alert-error">{error}</div>}
      {options.google && (
        <a className="google-button" href={`${BASE}/auth/google/start`}>
          <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
            <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.6c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41 15.5 46 24 46z" />
            <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2 20.4 2 24s1 6.9 2.5 9.9l7.3-5.7z" />
            <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 7 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
          </svg>
          Sign in with Google
        </a>
      )}
      {options.google && <div className="login-divider">Or</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label" htmlFor="email-field">School email</label>
          <input className="form-input" id="email-field" type="email" placeholder={`name@${options.domain || 'e-p-s.in'}`} required
            autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck="false" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <PasswordField id="password-field" label="Password" placeholder="Enter your password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" className="login-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
      </form>
      <p className="footer-note" style={{ marginTop: 18 }}>Forgot your password? Ask your school administrator to reset it.</p>
    </AuthShell>
  );
}
