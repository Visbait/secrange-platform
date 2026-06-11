import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, bootstrapSession } from '../lib/api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await bootstrapSession();
      if (res?.user) setUser(res.user);
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken); setUser(data.user); return data.user;
  }, []);

  const register = useCallback(async (email, password, displayName) => {
    const data = await api('/auth/register', { method: 'POST', body: { email, password, displayName } });
    setAccessToken(data.accessToken); setUser(data.user); return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null); setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}
