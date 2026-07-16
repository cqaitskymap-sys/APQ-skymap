const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

export class FirebaseNotConfiguredError extends Error {
  constructor(message = 'Firebase is not configured. Copy .env.example to .env.local and add your project credentials.') {
    super(message);
    this.name = 'FirebaseNotConfiguredError';
  }
}

// Static process.env references — Next.js only inlines NEXT_PUBLIC_* on the client when
// accessed literally (dynamic process.env[key] is always undefined in browser bundles).
/** Strip accidental quotes from .env values (a common cause of Storage 404 / CORS errors). */
export function normalizeFirebaseEnvValue(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

export function getFirebaseStorageBucket(): string {
  return normalizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    normalizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      normalizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) &&
      normalizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
      getFirebaseStorageBucket() &&
      normalizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) &&
      normalizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
  );
}

export function getFirebaseSetupMessage(): string {
  if (isFirebaseConfigured()) return '';
  const missing = REQUIRED_ENV_KEYS.filter((key) => {
    switch (key) {
      case 'NEXT_PUBLIC_FIREBASE_API_KEY':
        return !process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
      case 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN':
        return !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
      case 'NEXT_PUBLIC_FIREBASE_PROJECT_ID':
        return !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
      case 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET':
        return !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
      case 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID':
        return !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
      case 'NEXT_PUBLIC_FIREBASE_APP_ID':
        return !process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
      default:
        return true;
    }
  });
  return `Firebase environment variables are missing: ${missing.join(', ')}. Copy .env.example to .env.local and add your project credentials.`;
}

export type FirebaseServiceStatus = 'Connected' | 'Degraded' | 'Not Configured';

/** Returns configured bucket name for diagnostics (no network probe — avoids misleading CORS errors). */
export function getConfiguredStorageBucket(): string {
  return getFirebaseStorageBucket();
}

/** Storage health from env/SDK only — avoids client getMetadata probes that CORS-fail when the bucket or object is missing. */
export function getFirebaseStorageHealthStatus(): FirebaseServiceStatus {
  if (!isFirebaseConfigured()) return 'Not Configured';
  if (!getFirebaseStorageBucket()) return 'Not Configured';
  return 'Connected';
}
