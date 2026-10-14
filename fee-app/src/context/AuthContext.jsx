import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Holds who is signed in, as told by the server.
 *
 * The role kept here is only ever used to decide what to show. Every endpoint
 * re-checks it, so editing this state in a console gets an attacker nothing.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | signedIn | signedOut
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const applySession = useCallback((data) => {
    setUser(data.user);
    setMustChangePassword(Boolean(data.must_change_password));
    setStatus('signedIn');
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setMustChangePassword(false);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySession(await api.get('/api/auth/me'));
    } catch {
      clearSession();
    }
  }, [applySession, clearSession]);

  // Ask the server who is signed in, once, on load. The cookie is httpOnly so
  // this is the only way the app can find out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/api/auth/me');
        if (!cancelled) applySession(data);
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (username, password) => {
      const data = await api.post('/api/auth/login', { username, password });
      applySession(data);
      return data;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      // Whatever the server said, this browser is done with the session.
      clearSession();
    }
  }, [clearSession]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const data = await api.post('/api/auth/change-password', { currentPassword, newPassword });
      applySession(data);
      return data;
    },
    [applySession]
  );

  const value = useMemo(
    () => ({
      status,
      user,
      mustChangePassword,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      changePassword,
      refresh,
    }),
    [status, user, mustChangePassword, login, logout, changePassword, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
