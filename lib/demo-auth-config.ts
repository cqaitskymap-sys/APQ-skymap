/** Demo auth flag without heavy imports (keeps dev compile fast). */
export function isDemoAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';
}

/** Use demo auth when explicitly enabled OR Firebase env vars are missing (e.g. Netlify without env). */
export function shouldUseDemoAuth(): boolean {
  if (isDemoAuthEnabled()) return true;
  return !(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  );
}
