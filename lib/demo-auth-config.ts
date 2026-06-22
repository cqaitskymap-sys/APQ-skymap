/** Dev-only demo login. Set NEXT_PUBLIC_DEMO_AUTH=true in .env.local — never in production. */
export function isDemoAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';
}
