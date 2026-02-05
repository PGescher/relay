import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncNow } from '../data/sync/syncManager';

interface AuthContextType {
  user: any | null;
  token: string | null;
  login: (token: string, userData: any) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) Initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('relay-token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const userData = await res.json();
          setToken(storedToken);
          setUser(userData);

          // Auto-sync on app start (best-effort)
          try {
            await syncNow({ userId: userData.id, token: storedToken });
          } catch (e) {
            console.warn('Initial sync failed', e);
          }
        } else {
          localStorage.removeItem('relay-token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Auth check failed', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 2) Login stores token + user, then sync
  const login = (newToken: string, userData: any) => {
    localStorage.setItem('relay-token', newToken);
    setToken(newToken);
    setUser(userData);

    // fire-and-forget sync
    syncNow({ userId: userData.id, token: newToken }).catch((e) => {
      console.warn('Post-login sync failed', e);
    });
  };

  const logout = () => {
    localStorage.removeItem('relay-token');
    setToken(null);
    setUser(null);
  };

  // 3) Auto-sync when coming back online
  useEffect(() => {
    function onOnline() {
      if (token && user?.id) {
        syncNow({ userId: user.id, token }).catch((e) => console.warn('Online sync failed', e));
      }
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [token, user?.id]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
