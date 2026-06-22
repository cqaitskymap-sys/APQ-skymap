import type { Profile } from '@/lib/firebase';

const DEMO_SESSION_KEY = 'pharmaqms_demo_session';

export const DEMO_SUPER_ADMIN = {
  email: 'admin@pharmaQMS.com',
  password: 'demo123456',
} as const;

const demoProfile: Profile = {
  id: 'demo-super-admin',
  full_name: 'Super Admin (Demo)',
  email: DEMO_SUPER_ADMIN.email,
  role: 'super_admin',
  department: 'QA',
  employee_id: 'EMP001',
  phone: '',
  avatar_url: '',
  is_active: true,
  last_login: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function isDemoCredential(email: string, password: string): boolean {
  return (
    email.toLowerCase() === DEMO_SUPER_ADMIN.email.toLowerCase() &&
    password === DEMO_SUPER_ADMIN.password
  );
}

export function demoSignIn(email: string, password: string): { profile: Profile | null; error: string | null } {
  if (!isDemoCredential(email, password)) {
    return { profile: null, error: 'Invalid email or password' };
  }
  localStorage.setItem(DEMO_SESSION_KEY, demoProfile.id);
  document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  return { profile: { ...demoProfile, last_login: new Date().toISOString() }, error: null };
}

export function demoSignOut() {
  localStorage.removeItem(DEMO_SESSION_KEY);
  document.cookie = 'firebase-auth-session=; path=/; max-age=0; SameSite=Lax';
}

export function demoGetSession(): Profile | null {
  if (typeof window === 'undefined') return null;
  const uid = localStorage.getItem(DEMO_SESSION_KEY);
  if (!uid) return null;
  return demoProfile;
}
