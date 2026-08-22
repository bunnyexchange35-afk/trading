import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type User = { name: string; email: string };
type AuthMode = 'signin' | 'signup';
type Notice = { id: number; title: string; message: string; tone: 'success' | 'info' | 'warning' };

type AppState = {
  user: User | null;
  authMode: AuthMode | null;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  authenticate: (user: User) => void;
  signOut: () => void;
  notices: Notice[];
  notify: (title: string, message: string, tone?: Notice['tone']) => void;
  dismiss: (id: number) => void;
};

const AppContext = createContext<AppState | null>(null);
let noticeId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('mudrexx-user') || 'null') as User | null; } catch { return null; }
  });
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);

  const authenticate = useCallback((next: User) => {
    setUser(next);
    localStorage.setItem('mudrexx-user', JSON.stringify(next));
    setAuthMode(null);
  }, []);
  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('mudrexx-user');
  }, []);
  const notify = useCallback((title: string, message: string, tone: Notice['tone'] = 'success') => {
    const id = ++noticeId;
    setNotices((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);
  const dismiss = useCallback((id: number) => setNotices((current) => current.filter((item) => item.id !== id)), []);

  const value = useMemo<AppState>(() => ({
    user, authMode, openAuth: setAuthMode, closeAuth: () => setAuthMode(null), authenticate, signOut, notices, notify, dismiss,
  }), [user, authMode, authenticate, signOut, notices, notify, dismiss]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}
