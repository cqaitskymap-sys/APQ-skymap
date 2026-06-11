import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  getFirebaseAuth,
  getFirebaseFirestore,
  isFirebaseConfigured,
  FirebaseNotConfiguredError,
  type Profile,
  type UserRole,
} from './firebase';
import { writeAuditTrail } from './audit-trail';

export { isFirebaseConfigured, FirebaseNotConfiguredError } from './firebase';
export type { Profile, UserRole } from './firebase';

export const USERS_COLLECTION = 'users';
export const PROFILES_COLLECTION = 'profiles';

export const APP_ROLES: { id: UserRole; label: string }[] = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'admin', label: 'Admin' },
  { id: 'qa', label: 'QA' },
  { id: 'qc', label: 'QC' },
  { id: 'production', label: 'Production' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'regulatory', label: 'Regulatory' },
  { id: 'auditor', label: 'Auditor' },
];

function nowIso() {
  return new Date().toISOString();
}

function requireAuth() {
  if (!isFirebaseConfigured()) {
    throw new FirebaseNotConfiguredError();
  }
  return getFirebaseAuth();
}

function requireDb() {
  if (!isFirebaseConfigured()) {
    throw new FirebaseNotConfiguredError();
  }
  return getFirebaseFirestore();
}

export function formatAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection or use demo mode.',
  };
  if (code && messages[code]) return messages[code];
  if (error instanceof Error) return error.message;
  return 'Authentication failed. Please try again.';
}

export function isAuthNetworkError(error: unknown): boolean {
  return (error as { code?: string })?.code === 'auth/network-request-failed';
}

export async function signIn(email: string, password: string): Promise<User> {
  try {
    const auth = requireAuth();
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user) {
      await updateDoc(doc(requireDb(), PROFILES_COLLECTION, result.user.uid), {
        last_login: nowIso(),
        updated_at: nowIso(),
      }).catch(() => undefined);

      const profile = await getUserProfile(result.user.uid);
      await writeAuditTrail({
        collectionName: PROFILES_COLLECTION,
        documentId: result.user.uid,
        action: 'LOGIN',
        oldValue: null,
        newValue: { email },
        userId: result.user.uid,
        userName: profile?.full_name || email,
        moduleName: 'Auth',
      });
    }
    return result.user;
  } catch (error) {
    console.error('signIn failed:', error);
    throw error;
  }
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: UserRole = 'viewer',
): Promise<User> {
  try {
    const auth = requireAuth();
    const db = requireDb();
    const result = await createUserWithEmailAndPassword(auth, email, password);

    if (result.user) {
      await updateProfile(result.user, { displayName: fullName });

      const profile: Profile = {
        id: result.user.uid,
        email,
        full_name: fullName,
        role,
        department: '',
        employee_id: '',
        phone: '',
        avatar_url: '',
        is_active: true,
        last_login: nowIso(),
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      await setDoc(doc(db, PROFILES_COLLECTION, result.user.uid), profile);
      await setDoc(doc(db, USERS_COLLECTION, result.user.uid), {
        ...profile,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: 'active',
        isDeleted: false,
      });

      await writeAuditTrail({
        collectionName: USERS_COLLECTION,
        documentId: result.user.uid,
        action: 'CREATE',
        oldValue: null,
        newValue: { email, role },
        userId: result.user.uid,
        userName: fullName,
        moduleName: 'Auth',
      });
    }
    return result.user;
  } catch (error) {
    console.error('signUp failed:', error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    const auth = requireAuth();
    const user = auth.currentUser;
    if (user) {
      const profile = await getUserProfile(user.uid);
      await writeAuditTrail({
        collectionName: PROFILES_COLLECTION,
        documentId: user.uid,
        action: 'LOGOUT',
        oldValue: null,
        newValue: null,
        userId: user.uid,
        userName: profile?.full_name || user.email || 'User',
        moduleName: 'Auth',
      });
    }
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('signOut failed:', error);
    throw error;
  }
}

export function getCurrentUser(): User | null {
  if (!isFirebaseConfigured()) return null;
  try {
    return getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }
  try {
    return onAuthStateChanged(getFirebaseAuth(), callback);
  } catch (error) {
    console.error('Auth state subscription failed:', error);
    callback(null);
    return () => undefined;
  }
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const db = requireDb();
    const snap = await getDoc(doc(db, PROFILES_COLLECTION, userId));
    if (!snap.exists()) return null;
    return snap.data() as Profile;
  } catch (error) {
    console.error('getUserProfile failed:', error);
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Profile>,
): Promise<Profile | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const db = requireDb();
    const payload = { ...updates, updated_at: nowIso() };
    await updateDoc(doc(db, PROFILES_COLLECTION, userId), payload);
    return getUserProfile(userId);
  } catch (error) {
    console.error('updateUserProfile failed:', error);
    return null;
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    const auth = requireAuth();
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('resetPassword failed:', error);
    throw error;
  }
}
