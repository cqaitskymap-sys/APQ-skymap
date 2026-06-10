'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore, Profile, isDemoAuthEnabled } from '@/lib/firebase';
import {
  demoSignIn, demoSignUp, demoSignOut, demoGetSession, formatAuthError,
} from '@/lib/demo-auth';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = isDemoAuthEnabled();

  const fetchProfile = async (userId: string) => {
    try {
      const profileRef = doc(firestore, 'profiles', userId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as Profile);
      }
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

  useEffect(() => {
    if (isDemoMode) {
      const demoProfile = demoGetSession();
      setProfile(demoProfile);
      setUser(demoProfile ? ({ uid: demoProfile.id, email: demoProfile.email } as User) : null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser ?? null);
      if (currentUser) {
        document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        await fetchProfile(currentUser.uid);
      } else {
        document.cookie = 'firebase-auth-session=; path=/; max-age=0';
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      const { profile: demoProfile, error } = demoSignIn(email, password);
      if (error) return { error: new Error(error) };
      setProfile(demoProfile);
      setUser({ uid: demoProfile!.id, email: demoProfile!.email } as User);
      return { error: null };
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      return { error: new Error(formatAuthError(error)) };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    if (isDemoMode) {
      const { profile: demoProfile, error } = demoSignUp(email, password, fullName, role);
      if (error) return { error: new Error(error) };
      setProfile(demoProfile);
      setUser({ uid: demoProfile!.id, email: demoProfile!.email } as User);
      return { error: null };
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        const profileRef = doc(firestore, 'profiles', result.user.uid);
        await setDoc(profileRef, {
          id: result.user.uid,
          email,
          full_name: fullName,
          role,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Partial<Profile>);
      }
      return { error: null };
    } catch (error) {
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
    await firebaseSignOut(auth);
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
