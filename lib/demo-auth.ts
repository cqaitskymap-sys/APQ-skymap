import type { Profile } from '@/lib/firebase';

const DEMO_USERS_KEY = 'pharmaqms_demo_users';
const DEMO_SESSION_KEY = 'pharmaqms_demo_session';

interface DemoUser {
  uid: string;
  email: string;
  password: string;
  profile: Profile;
}

const defaultDemoUsers: DemoUser[] = [
  {
    uid: 'demo-admin',
    email: 'admin@pharmaQMS.com',
    password: 'demo123456',
    profile: {
      id: 'demo-admin',
      full_name: 'Super Admin',
      email: 'admin@pharmaQMS.com',
      role: 'super_admin',
      department: 'QA',
      employee_id: 'EMP001',
      phone: '',
      avatar_url: '',
      is_active: true,
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    uid: 'demo-qa',
    email: 'qa@pharmaQMS.com',
    password: 'demo123456',
    profile: {
      id: 'demo-qa',
      full_name: 'QA Manager',
      email: 'qa@pharmaQMS.com',
      role: 'qa',
      department: 'QA',
      employee_id: 'EMP002',
      phone: '',
      avatar_url: '',
      is_active: true,
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

function loadUsers(): DemoUser[] {
  if (typeof window === 'undefined') return defaultDemoUsers;
  try {
    const stored = localStorage.getItem(DEMO_USERS_KEY);
    if (stored) return JSON.parse(stored) as DemoUser[];
  } catch {
    // ignore
  }
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(defaultDemoUsers));
  return defaultDemoUsers;
}

function saveUsers(users: DemoUser[]) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

export function demoSignIn(email: string, password: string): { profile: Profile | null; error: string | null } {
  const users = loadUsers();
  const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!match) {
    return { profile: null, error: 'Invalid email or password' };
  }
  localStorage.setItem(DEMO_SESSION_KEY, match.uid);
  document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  return { profile: match.profile, error: null };
}

export function demoSignUp(
  email: string,
  password: string,
  fullName: string,
  role: string,
): { profile: Profile | null; error: string | null } {
  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { profile: null, error: 'Email already registered' };
  }
  const uid = `demo-${Date.now()}`;
  const profile: Profile = {
    id: uid,
    full_name: fullName,
    email,
    role: role as Profile['role'],
    department: 'QA',
    employee_id: '',
    phone: '',
    avatar_url: '',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  users.push({ uid, email, password, profile });
  saveUsers(users);
  localStorage.setItem(DEMO_SESSION_KEY, uid);
  document.cookie = `firebase-auth-session=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  return { profile, error: null };
}

export function demoSignOut() {
  localStorage.removeItem(DEMO_SESSION_KEY);
  document.cookie = 'firebase-auth-session=; path=/; max-age=0';
}

export function demoGetSession(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const uid = localStorage.getItem(DEMO_SESSION_KEY);
    if (!uid) return null;
    const users = loadUsers();
    return users.find((u) => u.uid === uid)?.profile ?? null;
  } catch {
    return null;
  }
}

export function isAuthNetworkError(error: unknown): boolean {
  const message = ((error as Error)?.message || String(error)).toLowerCase();
  return (
    message.includes('auth/network-request-failed') ||
    message.includes('err_ssl') ||
    message.includes('ssl') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  );
}

export function formatAuthError(error: unknown): string {
  const message = (error as Error)?.message || String(error);
  if (isAuthNetworkError(error)) {
    return 'Network/SSL error connecting to Firebase. Enable NEXT_PUBLIC_DEMO_AUTH=true in .env.local for local development, or disable antivirus HTTPS scanning.';
  }
  if (message.includes('auth/email-already-in-use')) return 'This email is already registered.';
  if (message.includes('auth/weak-password')) return 'Password is too weak. Use at least 8 characters.';
  if (message.includes('auth/invalid-email')) return 'Invalid email address.';
  if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) return 'Invalid email or password.';
  return message;
}
