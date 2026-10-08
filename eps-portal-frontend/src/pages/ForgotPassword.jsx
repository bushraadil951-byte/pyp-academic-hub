import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import AuthShell, { PasswordField, passwordHint } from './AuthShell.jsx';

// Step 1: username -> a 6-digit code is emailed.  Step 2: code + new password.  Step 3: done.
export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);            // seconds until "Send a new code" is available

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.post('/account/forgot', { username: username.trim() });
      setInfo(r.message); setStep(2); setWait(60);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');
    if (pw !== pw2) return setError('The two passwords do not match.');
    const hint = passwordHint(pw, username.trim());
    if (hint) return setError(hint);
    setBusy(true);
    try {
      await api.post('/account/reset', { username: username.trim(), code: code.trim(), newPassword: pw });
      setStep(3);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      {step === 1 && (
        <>
          <div className="login-heading">Forgot password?</div>
          <p className="login-subheading">Enter your username and we will email you a 6-digit code.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={send}>
            <div className="form-group">
              <label className="form-label" htmlFor="fp-username">Username</label>
              <input className="form-input" id="fp-username" placeholder="Enter your username" required autoCapitalize="off" autoCorrect="off" spellCheck="false"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <button type="submit" className="login-button" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
          <p className="footer-note" style={{ marginTop: 16 }}>Students: the code goes to the parent or guardian email the school has on file. No email on file? Ask your teacher or the school office to reset your password.</p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="login-heading">Enter your code</div>
          <p className="login-subheading">{info}</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={reset} autoComplete="off">
            <div className="form-group">
              <label className="form-label" htmlFor="fp-code">6-digit code</label>
              <input className="form-input" id="fp-code" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="123456" required autoComplete="one-time-code"
                style={{ letterSpacing: 6, fontSize: '1.2rem', textAlign: 'center' }} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ''))} />
            </div>
            <PasswordField id="fp-new" label="New password" placeholder="At least 8 characters, with a letter and a number" value={pw} onChange={setPw} />
            {passwordHint(pw, username.trim()) && <div className="sec-sub" style={{ margin: '-6px 0 10px', color: 'var(--red)' }}>{passwordHint(pw, username.trim())}</div>}
            <PasswordField id="fp-new2" label="Confirm new password" placeholder="Type it again" value={pw2} onChange={setPw2} />
            <button type="submit" className="login-button" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: '.82rem' }}>
            <button type="button" className="btn btn-secondary btn-xs" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</button>
            <button type="button" className="btn btn-secondary btn-xs" onClick={() => { setStep(1); setError(''); setCode(''); }}>Change username</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="login-heading">Password reset</div>
          <div className="alert alert-success">Your password has been changed. Sign in with your new password.</div>
          <Link to="/" className="login-button" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go to sign in</Link>
        </>
      )}

      {step !== 3 && <div style={{ textAlign: 'center', marginTop: 18 }}><Link to="/" style={{ fontSize: '.85rem', fontWeight: 600 }}>← Back to sign in</Link></div>}
    </AuthShell>
  );
}
