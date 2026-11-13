// People no longer choose usernames, but marks, CSV files and older records still use them.
// This makes one from the school email: asha.khan@e-p-s.in -> asha.khan, then asha.khan1 if that is taken.
export function usernameFromEmail(email, taken) {
  const base = email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 45) || 'user';
  let username = base; let n = 1;
  while (taken.has(username)) { username = `${base}${n}`; n += 1; }
  return username;
}
