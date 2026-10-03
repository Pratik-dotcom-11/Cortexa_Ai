import { User, ApiResponse } from '../types';
import { storage } from './storage';

const TOKEN_KEY = 'studyai_jwt_token';

export const authService = {
  async getCurrentUser(): Promise<ApiResponse<User | null>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      return { success: true, data: null };
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const raw = await res.json();
        const data = raw?.data?.user || raw?.user || raw?.data || raw;
        const mappedUser: User = {
          id: data.uid || data.id?.toString() || 'user',
          email: data.email,
          fullName: data.displayName || data.fullName || 'Student',
          university: data.university || 'State University',
          major: data.major || 'Computer Science',
          weeklyGoalHours: 15,
          createdAt: data.createdAt || new Date().toISOString(),
        };
        storage.setUser(mappedUser);
        return { success: true, data: mappedUser };
      } else {
        localStorage.removeItem(TOKEN_KEY);
        storage.setUser(null);
        return { success: false, data: null, error: 'Session expired' };
      }
    } catch {
      const local = storage.getUser();
      return { success: true, data: local };
    }
  },

  async login(email: string, password: string): Promise<ApiResponse<User>> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const raw = await res.json();
      if (!res.ok) {
        return {
          success: false,
          data: null as any,
          error: raw?.message || raw?.error || 'Invalid email or password',
        };
      }

      const payload = raw?.data || raw;
      if (payload.token) {
        localStorage.setItem(TOKEN_KEY, payload.token);
      }

      const userRecord = payload.user || payload;
      const mappedUser: User = {
        id: userRecord.uid || userRecord.id?.toString() || 'user',
        email: userRecord.email,
        fullName: userRecord.displayName || userRecord.fullName || 'Student',
        university: userRecord.university || 'State University',
        major: userRecord.major || 'Computer Science',
        weeklyGoalHours: 15,
        createdAt: userRecord.createdAt || new Date().toISOString(),
      };

      storage.setUser(mappedUser);
      return {
        success: true,
        data: mappedUser,
        message: 'Logged in successfully',
      };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: err.message || 'Network error during login',
      };
    }
  },

  async register(params: {
    email: string;
    password: string;
    fullName: string;
    university?: string;
    major?: string;
  }): Promise<ApiResponse<User>> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email.trim(),
          password: params.password,
          displayName: params.fullName.trim(),
          university: params.university?.trim(),
          major: params.major?.trim(),
        }),
      });

      const raw = await res.json();
      if (!res.ok) {
        const issues = raw?.data?.issues?.join(', ');
        return {
          success: false,
          data: null as any,
          error: issues || raw?.message || raw?.error || 'Registration failed',
        };
      }

      const payload = raw?.data || raw;
      if (payload.token) {
        localStorage.setItem(TOKEN_KEY, payload.token);
      }

      const userRecord = payload.user || payload;
      const mappedUser: User = {
        id: userRecord.uid || userRecord.id?.toString() || 'user',
        email: userRecord.email,
        fullName: userRecord.displayName || userRecord.fullName || params.fullName,
        university: userRecord.university || params.university || 'University',
        major: userRecord.major || params.major || 'Undergraduate Studies',
        weeklyGoalHours: 15,
        createdAt: userRecord.createdAt || new Date().toISOString(),
      };

      storage.setUser(mappedUser);
      return {
        success: true,
        data: mappedUser,
        message: 'Account created successfully',
      };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: err.message || 'Network error during registration',
      };
    }
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    try {
      if (token) {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: updates.fullName,
            university: updates.university,
            major: updates.major,
          }),
        });
      }
    } catch {
      // Ignore background sync errors
    }

    const currentUser = storage.getUser();
    if (!currentUser) {
      return { success: false, data: null as any, error: 'User not authenticated' };
    }
    const updated = { ...currentUser, ...updates };
    storage.setUser(updated);
    return {
      success: true,
      data: updated,
      message: 'Profile updated',
    };
  },

  async logout(): Promise<ApiResponse<null>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    storage.setUser(null);
    return {
      success: true,
      data: null,
      message: 'Logged out',
    };
  },
};
