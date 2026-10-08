import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useFlash } from '../flash.jsx';
import AuthShell, { PasswordField, passwordHint } from './AuthShell.jsx';

// Used twice: forced after an admin sets or resets a password, and voluntarily from the sidebar.
export default function ChangePassword() {
  const { user, setUser, logout } = useAuth();
  const flash = useFlash();
  const nav = useNavigate();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return <Navigate to="/" replace />;

  const forced = user.mustChange;
  const isStudent = user.role === 'student';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pw !== pw2) return setError('The two new passwords do not match.');
    const hint = passwordHint(pw);
    if (hint) return setError(hint);
    setBusy(true);
    try {
      const r = await api.post('/account/change-password', { currentPassword: cur, newPassword: pw, email: email.trim() });
      setUser(r.user);
      flash('Your password has been changed.');
      nav('/portal');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <div className="login-heading">{forced ? 'Set a new password' : 'Change password'}</div>
      <p className="login-subheading">
        {forced ? `Welcome, ${user.name}. For your security, choose your own password before you continue.` : 'Choose a new password for your account.'}
      </p>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={submit} autoComplete="off">
        <PasswordField id="cp-cur" label={forced ? 'Temporary password you were given' : 'Current password'} placeholder="Enter it here" value={cur} onChange={setCur} autoComplete="current-password" />
        <PasswordField id="cp-new" label="New password" placeholder="At least 8 characters, with a letter and a number" value={pw} onChange={setPw} />
        {passwordHint(pw) && <div className="sec-sub" style={{ margin: '-6px 0 10px', color: 'var(--red)' }}>{passwordHint(pw)}</div>}
        <PasswordField id="cp-new2" label="Confirm new password" placeholder="Type it again" value={pw2} onChange={setPw2} />
        <div className="form-group">
          <label className="form-label" htmlFor="cp-email">{isStudent ? 'Parent or guardian email' : 'Email'} (used to send password reset codes)</label>
          <input className="form-input" id="cp-email" type="email" placeholder="name@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="login-button" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: '.85rem' }}>
        {forced
          ? <button type="button" className="btn btn-secondary btn-xs" onClick={logout}>Sign out</button>
          : <Link to="/portal" style={{ fontWeight: 600 }}>← Back to portal</Link>}
      </div>
    </AuthShell>
  );
}
