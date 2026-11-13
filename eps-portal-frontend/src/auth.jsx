import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { id, name, role, grade, email, mustChange }
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState({ google: false, domain: '' });   // what the sign-in page offers

  useEffect(() => {
    Promise.all([
      api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)),
      api.get('/auth/options').then(setOptions).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);

  return <AuthCtx.Provider value={{ user, setUser, loading, login, logout, options }}>{children}</AuthCtx.Provider>;
}
