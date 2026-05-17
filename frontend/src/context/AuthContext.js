import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ballbook_token'));
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async (tkn) => {
    try {
      const res = await authAPI.getMe(tkn);
      setUser(res.data);
    } catch {
      // Token invalid or expired — clear it
      localStorage.removeItem('ballbook_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, fetchCurrentUser]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('ballbook_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const register = async (formData) => {
    const res = await authAPI.register(formData);
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('ballbook_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('ballbook_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export default AuthContext;
