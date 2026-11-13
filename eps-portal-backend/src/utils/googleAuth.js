// "Sign in with Google" using the OAuth authorization code flow. The server talks to Google directly, so no Google
// script runs in the browser. Who may sign in is decided here and in routes/auth.js, never by the browser.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const googleEnabled = () => !!(config.google.clientId && config.google.clientSecret);
const redirectUri = () => `${config.appUrl}/api/auth/google/callback`;
export const randomToken = () => crypto.randomBytes(32).toString('hex');

export function googleAuthUrl(state, nonce) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    hd: config.google.allowedDomain,   // only a hint for Google's account picker: checkClaims() is the real check
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${params}`;
}

// Swaps the one-time code for the signed-in person's details. The token comes straight from Google over HTTPS,
// so its contents can be trusted without checking the signature; checkClaims() still checks who it is for.
export async function fetchGoogleClaims(code) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) throw new Error(`Google rejected the sign-in code (${r.status})`);
  const claims = jwt.decode((await r.json()).id_token);
  if (!claims) throw new Error('Google sent no identity token');
  return claims;
}

// Returns the person's lower-case school email, or null if this token must not be accepted.
export function checkClaims(claims, nonce) {
  const domain = config.google.allowedDomain;
  const email = String(claims.email || '').toLowerCase();
  if (!ISSUERS.includes(claims.iss)) return null;
  if (claims.aud !== config.google.clientId) return null;
  if (claims.nonce !== nonce) return null;
  if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
  if (claims.email_verified !== true) return null;
  if (claims.hd !== domain) return null;             // a Workspace account of this domain, not a personal Google account
  if (!email.endsWith(`@${domain}`)) return null;
  return email;
}
