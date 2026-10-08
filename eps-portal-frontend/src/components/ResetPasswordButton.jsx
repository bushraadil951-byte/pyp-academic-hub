import { useState } from 'react';
import { api } from '../api.js';
import { useFlash } from '../flash.jsx';
import { Modal } from './ui.jsx';

// Issues a one-time temporary password for a teacher or student. The person must choose their own at next sign-in.
export default function ResetPasswordButton({ person }) {
  const flash = useFlash();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!window.confirm(`Reset the password for ${person.name}?\n\nThey will be signed out and must choose a new password the next time they sign in.`)) return;
    setBusy(true);
    try { setResult(await api.post(`/account/admin-reset/${person.id}`)); }
    catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.tempPassword); flash('Temporary password copied.'); } catch { flash('Copy failed: select the password and copy it by hand.', 'error'); }
  };

  return (
    <>
      <button className="btn btn-secondary btn-xs" disabled={busy} onClick={run}>Reset password</button>
      {result && (
        <Modal title="Temporary password" onClose={() => setResult(null)}>
          <p className="sec-sub" style={{ marginBottom: 10 }}>Give this to <strong>{result.name}</strong> (username <strong>{result.username}</strong>). It is shown only once.</p>
          <div style={{ fontFamily: 'monospace', fontSize: '1.5rem', letterSpacing: 2, textAlign: 'center', padding: 14, background: 'var(--surface2)', borderRadius: 10, userSelect: 'all' }}>{result.tempPassword}</div>
          <p className="sec-sub" style={{ margin: '10px 0' }}>They will be asked to choose their own password the first time they sign in with it.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={copy}>Copy</button>
            <button className="btn btn-primary" onClick={() => setResult(null)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  );
}
