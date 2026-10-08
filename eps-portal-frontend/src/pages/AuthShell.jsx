import { useState } from 'react';
import './login.css';

// The two-panel frame shared by Sign in, Forgot password and Set a new password.
export default function AuthShell({ children }) {
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
            {children}
            <div className="login-footer">Eastern Public School · PYP Academic Hub</div>
          </div>
        </div>
      </div>
      <div className="developer-credit">Credit: Developer - Bushra Khan</div>
    </>
  );
}

// Password field with a SHOW/HIDE toggle (reuses the login page styles).
export function PasswordField({ id, label, value, onChange, placeholder, autoComplete = 'new-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="password-box">
        <input className="form-input" id={id} type={show ? 'text' : 'password'} placeholder={placeholder} required autoComplete={autoComplete}
          value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="password-toggle" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
          {show ? 'HIDE' : 'SHOW'}
        </button>
      </div>
    </div>
  );
}


// The same rules the server enforces (src/utils/passwordPolicy.js), shown live as hints.
export function passwordHint(pw, username = '') {
  if (!pw) return '';
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Include at least one letter and one number.';
  if (username && pw.toLowerCase() === username.toLowerCase()) return 'Your password cannot be the same as your username.';
  return '';
}
