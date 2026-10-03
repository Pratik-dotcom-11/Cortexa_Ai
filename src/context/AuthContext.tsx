import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserProfile } from '../types/app.types.ts';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signInAsDemoStudent: (role?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileData: (data: { displayName?: string; university?: string; major?: string }) => Promise<void>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_STORAGE_KEY = 'studyai_jwt_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isSigningInRef = useRef(false);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (jwtToken) return jwtToken;
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch {
        return null;
      }
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    return stored;
  }, [jwtToken]);

  const apiFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const token = await getToken();
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      let lastError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, {
            ...init,
            headers,
          });

          if (res.status === 401) {
            console.warn('Unauthorized response: session expired or token revoked');
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            setJwtToken(null);
            setProfile(null);
          }

          return res;
        } catch (err: any) {
          lastError = err;
          // Retry on network errors
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
      }

      throw lastError || new Error('Failed to fetch from server after multiple retries.');
    },
    [getToken],
  );

  const refreshProfile = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const raw = await res.json();
        const user = raw?.data?.user || raw?.user || raw?.data || raw;
        setProfile(user);
      }
    } catch (e) {
      console.warn('Failed to refresh profile:', e);
    }
  }, [apiFetch]);

  // Restore authenticated session on initial mount
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          if (res.ok) {
            const raw = await res.json();
            const user = raw?.data?.user || raw?.user || raw?.data || raw;
            if (isMounted) {
              setProfile(user);
              setJwtToken(storedToken);
              setLoading(false);
              return;
            }
          } else {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            if (isMounted) setJwtToken(null);
          }
        } catch {
          // Network error or offline
        }
      }

      // Fallback: check Firebase Auth state
      const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
        if (!isMounted) return;
        setFirebaseUser(fUser);
        if (fUser) {
          try {
            const token = await fUser.getIdToken();
            const res = await fetch('/api/auth/sync', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                displayName: fUser.displayName,
                photoUrl: fUser.photoURL,
              }),
            });
            if (res.ok) {
              const raw = await res.json();
              const user = raw?.data?.user || raw?.user || raw?.data || raw;
              setProfile(user);
            }
          } catch (err) {
            console.warn('Firebase user sync failed:', err);
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();
    };

    restoreSession().finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentUser: AuthUser | null = profile
    ? {
        uid: profile.uid || (profile as any).id?.toString() || 'user',
        email: profile.email || null,
        displayName: profile.displayName || 'Student',
        photoURL: (profile as any).photoUrl || null,
      }
    : firebaseUser
    ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      }
    : null;

  const isAuthenticated = Boolean(profile || firebaseUser || jwtToken);

  const signIn = async () => {
    if (isSigningInRef.current || isSigningIn) return;
    isSigningInRef.current = true;
    setIsSigningIn(true);
    setAuthError(null);

    try {
      let cred;
      try {
        cred = await signInWithPopup(auth, googleAuthProvider);
      } catch (error: any) {
        const code = String(error?.code || '');
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleAuthProvider);
          return;
        }
        throw error;
      }

      if (cred.user) {
        const token = await cred.user.getIdToken();
        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: cred.user.displayName,
            photoUrl: cred.user.photoURL,
          }),
        });
        if (res.ok) {
          const raw = await res.json();
          const user = raw?.data?.user || raw?.user || raw?.data || raw;
          setProfile(user);
        }
      }
    } catch (error: any) {
      const code = String(error?.code || '');
      const message = String(error?.message || '');
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/user-cancelled' ||
        message.includes('popup-closed-by-user') ||
        message.includes('cancelled-popup-request') ||
        message.includes('user-cancelled')
      ) {
        return;
      }
      setAuthError('Google sign in was not completed. You can try email login or Instant Demo.');
    } finally {
      setIsSigningIn(false);
      isSigningInRef.current = false;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (isSigningInRef.current) return;
    isSigningInRef.current = true;
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pass }),
      });

      const raw = await res.json();
      if (!res.ok) {
        throw new Error(raw?.message || raw?.error || 'Invalid email or password');
      }

      const payload = raw?.data || raw;
      if (payload.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
        setJwtToken(payload.token);
        setProfile(payload.user);
      }
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed. Please verify credentials.');
      throw error;
    } finally {
      setIsSigningIn(false);
      isSigningInRef.current = false;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    if (isSigningInRef.current) return;
    isSigningInRef.current = true;
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pass,
          displayName: name?.trim() || undefined,
        }),
      });

      const raw = await res.json();
      if (!res.ok) {
        const issues = raw?.data?.issues?.join(', ');
        throw new Error(issues || raw?.message || raw?.error || 'Failed to create account');
      }

      const payload = raw?.data || raw;
      if (payload.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
        setJwtToken(payload.token);
        setProfile(payload.user);
      }
    } catch (error: any) {
      setAuthError(error.message || 'Account registration failed.');
      throw error;
    } finally {
      setIsSigningIn(false);
      isSigningInRef.current = false;
    }
  };

  const signInAsDemoStudent = async (role: string = 'cs') => {
    setAuthError(null);
    setIsSigningIn(true);

    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const raw = await res.json();
      if (!res.ok) {
        throw new Error(raw?.message || 'Failed to initialize demo session');
      }

      const payload = raw?.data || raw;
      if (payload.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
        setJwtToken(payload.token);
        setProfile(payload.user);
      }
    } catch (e: any) {
      console.warn('Error launching demo student:', e);
      setAuthError('Failed to launch demo session');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = jwtToken || localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        // Notify server to revoke token in token blocklist
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }

      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem('studyai_demo_user');
      setJwtToken(null);
      setProfile(null);

      if (auth.currentUser) {
        await signOut(auth).catch(() => {});
        setFirebaseUser(null);
      }
    } catch (error) {
      console.warn('Error during logout:', error);
    }
  };

  const updateProfileData = async (data: { displayName?: string; university?: string; major?: string }) => {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      setProfile(json?.data?.user || json?.user || json);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        isAuthenticated,
        profile,
        loading,
        isSigningIn,
        authError,
        clearAuthError,
        signInWithGoogle: signIn,
        signInWithEmail,
        signUpWithEmail,
        signInAsDemoStudent,
        logout: handleLogout,
        updateProfileData,
        apiFetch,
        refreshProfile,
      }}
    >
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
