/** Clears client-side auth session cookies before navigating to login. */
export function clearAuthSessionCookies() {
  if (typeof document === 'undefined') return;
  document.cookie = 'firebase-auth-session=; path=/; max-age=0; SameSite=Lax';
  document.cookie = '__session=; path=/; max-age=0; SameSite=Lax';
}
