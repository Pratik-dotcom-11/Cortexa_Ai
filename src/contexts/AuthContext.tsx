import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (params: {
    email: string;
    password: string;
    fullName: string;
    university?: string;
    major?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const res = await authService.getCurrentUser();
        if (res.success && res.data) {
          setUser(res.data);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await authService.login(email, password);
      if (res.success && res.data) {
        setUser(res.data);
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to login' };
    } catch {
      return { success: false, error: 'Network error during login' };
    }
  };

  const register = async (params: {
    email: string;
    password: string;
    fullName: string;
    university?: string;
    major?: string;
  }) => {
    try {
      const res = await authService.register(params);
      if (res.success && res.data) {
        setUser(res.data);
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to register' };
    } catch {
      return { success: false, error: 'Network error during registration' };
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateProfile = async (updates: Partial<User>) => {
    const res = await authService.updateProfile(updates);
    if (res.success && res.data) {
      setUser(res.data);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
