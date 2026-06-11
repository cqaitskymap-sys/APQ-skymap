'use client';

import {
  createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import type { Profile } from '@/lib/firebase';
import { isDemoAuthEnabled } from '@/lib/demo-auth-config';
import {
  demoSignIn, demoSignUp, demoSignOut, demoGetSession,
} from '@/lib/demo-auth';
import {
  formatAuthError, isAuthNetworkError, getUserProfile, subscribeToAuthState,
} from '@/lib/auth';

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

function toDemoUser(profile: Profile): User {
  return { uid: profile.id, email: profile.email } as User;
}

function applyDemoSession(
  setProfile: (p: Profile | null) => void,
  setUser: (u: User | null) => void,
) {
  const demoProfile = demoGetSession();
  if (!demoProfile) clearAuthCookies();
  setProfile(demoProfile);
  setUser(demoProfile ? toDemoUser(demoProfile) : null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoEnabled = isDemoAuthEnabled();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(demoEnabled);

  const activateDemoSession = (demoProfile: Profile) => {
    setIsDemoMode(true);
    setProfile(demoProfile);
    setUser(toDemoUser(demoProfile));
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    try {
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

  // Resolve demo session before paint to avoid hydration mismatch + auth spinner stuck.
  useLayoutEffect(() => {
    if (!isDemoMode) return;
    applyDemoSession(setProfile, setUser);
    setLoading(false);
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    void (async () => {
      try {
        const { isFirebaseConfigured } = await import('@/lib/firebase');
        if (!isFirebaseConfigured()) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (cancelled) return;

        unsubscribe = subscribeToAuthState((currentUser) => {
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
  }, [isDemoMode]);

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      const { profile: demoProfile, error } = demoSignIn(email, password);
      if (error) return { error: new Error(error) };
      activateDemoSession(demoProfile!);
      return { error: null };
    }

    try {
      const { signIn: firebaseSignIn } = await import('@/lib/auth');
      await firebaseSignIn(email, password);
      return { error: null };
    } catch (error) {
      if (isAuthNetworkError(error)) {
        const demoResult = demoSignIn(email, password);
        if (demoResult.profile) {
          activateDemoSession(demoResult.profile);
          return { error: null };
        }
      }
      return { error: new Error(formatAuthError(error)) };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    if (isDemoMode) {
      const { profile: demoProfile, error } = demoSignUp(email, password, fullName, role);
      if (error) return { error: new Error(error) };
      activateDemoSession(demoProfile!);
      return { error: null };
    }

    try {
      const { signUp: firebaseSignUp } = await import('@/lib/auth');
      await firebaseSignUp(email, password, fullName, role as Profile['role']);
      return { error: null };
    } catch (error) {
      if (isAuthNetworkError(error)) {
        const demoResult = demoSignUp(email, password, fullName, role);
        if (demoResult.profile) {
          activateDemoSession(demoResult.profile);
          return { error: null };
        }
      }
      return { error: new Error(formatAuthError(error)) };
    }
  };

  const signOut = async () => {
    if (isDemoMode) {
      demoSignOut();
      setUser(null);
      setProfile(null);
      return;
    }
    const { signOut: firebaseSignOut } = await import('@/lib/auth');
    await firebaseSignOut();
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
