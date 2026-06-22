/**
 * Creates the default Super Admin in Firebase Auth + Firestore profile.
 * Run once: node scripts/setup-default-admin.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEFAULT_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@apq-skymap.com';
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
const DEFAULT_NAME = 'Super Admin';

function loadEnv() {
  const envPath = resolve(root, '.env.local');
  if (!existsSync(envPath)) {
    console.error('Missing .env.local — add Firebase NEXT_PUBLIC_* variables first.');
    process.exit(1);
  }
  const vars = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

async function authRequest(apiKey, endpoint, body) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || res.statusText);
    err.code = data.error?.message;
    throw err;
  }
  return data;
}

async function ensureAuthUser(apiKey) {
  try {
    const data = await authRequest(apiKey, 'signUp', {
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      returnSecureToken: true,
    });
    console.log('Created Firebase Auth user:', DEFAULT_EMAIL);
    return { uid: data.localId, idToken: data.idToken };
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS') {
      const data = await authRequest(apiKey, 'signInWithPassword', {
        email: DEFAULT_EMAIL,
        password: DEFAULT_PASSWORD,
        returnSecureToken: true,
      });
      console.log('Firebase Auth user already exists:', DEFAULT_EMAIL);
      return { uid: data.localId, idToken: data.idToken };
    }
    throw error;
  }
}

async function ensureProfile(projectId, uid, idToken) {
  const now = new Date().toISOString();
  const docPath = `projects/${projectId}/databases/(default)/documents/profiles/${uid}`;
  const url = `https://firestore.googleapis.com/v1/${docPath}`;

  const fields = {
    id: { stringValue: uid },
    email: { stringValue: DEFAULT_EMAIL },
    full_name: { stringValue: DEFAULT_NAME },
    role: { stringValue: 'super_admin' },
    department: { stringValue: 'QA' },
    employee_id: { stringValue: 'EMP001' },
    phone: { stringValue: '' },
    avatar_url: { stringValue: '' },
    is_active: { booleanValue: true },
    last_login: { nullValue: null },
    created_at: { stringValue: now },
    updated_at: { stringValue: now },
  };

  const patchRes = await fetch(`${url}?updateMask.fieldPaths=role&updateMask.fieldPaths=full_name&updateMask.fieldPaths=updated_at&updateMask.fieldPaths=is_active`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (patchRes.status === 404) {
    const createRes = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Firestore profile create failed: ${err}`);
    }
    console.log('Created Firestore profile with role: super_admin');
    return;
  }

  if (!patchRes.ok) {
    const err = await patchRes.text();
    throw new Error(`Firestore profile update failed: ${err}`);
  }
  console.log('Updated Firestore profile to role: super_admin');
}

async function main() {
  const env = loadEnv();
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    console.error('NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID are required in .env.local');
    process.exit(1);
  }

  console.log('Setting up default admin...');
  console.log('  Email   :', DEFAULT_EMAIL);
  console.log('  Password:', DEFAULT_PASSWORD);
  console.log('  Project :', projectId);

  const { uid, idToken } = await ensureAuthUser(apiKey);
  await ensureProfile(projectId, uid, idToken);

  console.log('\nDone. Login with the credentials above for full Super Admin access.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message || err);
  process.exit(1);
});
