import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE, getToken, setToken, UNAUTHORIZED_EVENT } from '@/api/client';
import type { Session } from '@/api/types';

interface AuthValue {
  isAuthenticated: boolean;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(() => !!getToken());

  const signIn = useCallback(
    (session: Session) => {
      setToken(session.access_token);
      qc.clear();
      setAuthed(true);
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    // Drop the token locally first so no in-flight query reuses it after the server revokes it.
    const token = getToken();
    setToken(null);
    await qc.cancelQueries();
    qc.clear();
    setAuthed(false);
    if (token) {
      fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {
        /* offline — the token simply expires */
      });
    }
  }, [qc]);

  useEffect(() => {
    const onUnauthorized = () => {
      qc.clear();
      setAuthed(false);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc]);

  const value = useMemo(() => ({ isAuthenticated: authed, signIn, signOut }), [authed, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}
