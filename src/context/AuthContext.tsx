import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, clearAuthToken, getAuthToken } from '../lib/api';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: 'admin' | 'faculty' | 'student' | 'higher_official';
  department?: string;
  designation?: string;
  regNoOrEmpId?: string;
  classSection?: string;
  degree?: string;
  phone?: string;
  faceEnrolled?: boolean;
  profilePhoto?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasAdmin: boolean | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  setupFirstAdmin: (payload: any) => Promise<void>;
  refreshUser: () => Promise<void>;
  checkAdminStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  const checkAdminStatus = async () => {
    try {
      const res = await api.getAuthStatus();
      setHasAdmin(res.hasAdmin);
    } catch (e) {
      console.error('Failed to query admin status:', e);
    }
  };

  const refreshUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (e) {
      console.warn('Failed to load active user session:', e);
      clearAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus().then(() => refreshUser());
  }, []);

  const login = async (credentials: any) => {
    const res = await api.login(credentials);
    setAuthToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  const setupFirstAdmin = async (payload: any) => {
    const res = await api.setupAdmin(payload);
    setAuthToken(res.token);
    setUser(res.user);
    setHasAdmin(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasAdmin,
        login,
        logout,
        setupFirstAdmin,
        refreshUser,
        checkAdminStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
