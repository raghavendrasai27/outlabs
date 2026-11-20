import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  devLogin: (email?: string, name?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('reachinbox_token');
      if (token) {
        try {
          const profile = await api.auth.me();
          setUser(profile);
          localStorage.setItem('reachinbox_user', JSON.stringify(profile));
        } catch {
          localStorage.removeItem('reachinbox_token');
          localStorage.removeItem('reachinbox_user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('reachinbox_token', token);
    localStorage.setItem('reachinbox_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('reachinbox_token');
      localStorage.removeItem('reachinbox_user');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const devLogin = async (email = 'recruiter@reachinbox.ai', name = 'ReachInbox Evaluator') => {
    try {
      const res = await api.auth.demoLogin({ email, name });
      login(res.token, res.user);
    } catch (err) {
      console.error('Failed to perform demo login:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, devLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
