'use client';

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import type { Profile } from '@/lib/firebase';
import { FirebaseNotConfiguredError } from '@/lib/firebase-config';
import { clearAuthSessionCookies } from '@/lib/auth-session-cookies';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setAuthSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { getUserProfile } = await import('@/lib/auth');
      const data = await getUserProfile(userId);
      if (data) setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    void (async () => {
      try {
        const { isFirebaseConfigured } = await import('@/lib/firebase-config');
        if (!isFirebaseConfigured()) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (cancelled) return;

        const { subscribeToAuthState } = await import('@/lib/auth');
        unsubscribe = subscribeToAuthState((currentUser) => {
          setUser(currentUser ?? null);
          if (currentUser) {
            document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            void fetchProfile(currentUser.uid);
          } else {
            clearAuthSessionCookies();
            setProfile(null);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Firebase auth init failed:', error);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      unsubscribe?.();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { signIn: firebaseSignIn, isFirebaseConfigured } = await import('@/lib/auth');

    if (!isFirebaseConfigured()) {
      return {
        error: new Error(
          'Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables and restart the application.',
        ),
      };
    }

    try {
      const signedInUser = await firebaseSignIn(email, password);
      setAuthSessionCookie();
      await fetchProfile(signedInUser.uid);
      return { error: null };
    } catch (error) {
      if (error instanceof FirebaseNotConfiguredError || (error as Error)?.name === 'FirebaseNotConfiguredError') {
        return {
          error: new Error(
            'Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables and restart the application.',
          ),
        };
      }
      return { error: new Error((await import('@/lib/auth')).formatAuthError(error)) };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    try {
      const { signUp: firebaseSignUp, isFirebaseConfigured } = await import('@/lib/auth');
      if (!isFirebaseConfigured()) {
        return {
          error: new Error(
            'Firebase is not configured. Contact your system administrator.',
          ),
        };
      }
      await firebaseSignUp(email, password, fullName, role as Profile['role']);
      return { error: null };
    } catch (error) {
      return { error: new Error((await import('@/lib/auth')).formatAuthError(error)) };
    }
  };

  const signOut = async () => {
    const { signOut: firebaseSignOut } = await import('@/lib/auth');
    await firebaseSignOut();
    clearAuthSessionCookies();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
