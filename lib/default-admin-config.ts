/** Default Super Admin — create in Firebase via `npm run setup:admin` or Firebase Console. */
export const DEFAULT_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL?.trim() || 'admin@apq-skymap.com';

export const DEFAULT_ADMIN_PASSWORD = 'Admin@123456';

export function showDefaultAdminHint(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DEFAULT_ADMIN_HINT !== 'false';
}
