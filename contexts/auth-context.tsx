'use client';

import {
  createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import type { Profile } from '@/lib/firebase';
import { isDemoAuthEnabled } from '@/lib/demo-auth-config';
import { demoSignIn, demoSignOut, demoGetSession, isDemoCredential } from '@/lib/demo-auth';
import { FirebaseNotConfiguredError } from '@/lib/firebase-config';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearAuthCookies() {
  if (typeof document === 'undefined') return;
  document.cookie = 'firebase-auth-session=; path=/; max-age=0; SameSite=Lax';
  document.cookie = '__session=; path=/; max-age=0; SameSite=Lax';
}

function setAuthSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function toDemoUser(profile: Profile): User {
  return { uid: profile.id, email: profile.email } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoEnabled = isDemoAuthEnabled();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const activateDemoSession = (demoProfile: Profile) => {
    setIsDemoMode(true);
    setProfile(demoProfile);
    setUser(toDemoUser(demoProfile));
    setLoading(false);
  };

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
    if (isDemoMode) {
      setProfile(demoGetSession());
      return;
    }
    if (user) await fetchProfile(user.uid);
  };

  useLayoutEffect(() => {
    if (!demoEnabled) return;
    const session = demoGetSession();
    if (session) activateDemoSession(session);
    else setLoading(false);
  }, [demoEnabled]);

  useEffect(() => {
    if (demoEnabled && demoGetSession()) return;

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
          if (isDemoMode) return;
          setUser(currentUser ?? null);
          if (currentUser) {
            document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            void fetchProfile(currentUser.uid);
          } else {
            clearAuthCookies();
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
  }, [demoEnabled, isDemoMode]);

  const signIn = async (email: string, password: string) => {
    const { signIn: firebaseSignIn, isFirebaseConfigured } = await import('@/lib/auth');
    const firebaseReady = isFirebaseConfigured();

    // Local demo Super Admin (optional dev shortcut — not a real Firebase account).
    if (demoEnabled && isDemoCredential(email, password)) {
      const { profile: demoProfile, error } = demoSignIn(email, password);
      if (error) return { error: new Error(error) };
      activateDemoSession(demoProfile!);
      return { error: null };
    }

    if (!firebaseReady) {
      return {
        error: new Error(
          'Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables and restart the application.',
        ),
      };
    }

    try {
      if (isDemoMode) {
        demoSignOut();
        setIsDemoMode(false);
      }
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
    if (demoEnabled) {
      return { error: new Error('Sign up is disabled in demo mode. Use the demo Super Admin credentials.') };
    }

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
    if (isDemoMode) {
      demoSignOut();
      setUser(null);
      setProfile(null);
      setIsDemoMode(false);
      return;
    }
    const { signOut: firebaseSignOut } = await import('@/lib/auth');
    await firebaseSignOut();
    clearAuthCookies();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isDemoMode, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
