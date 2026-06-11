/** Demo auth flag without importing Firebase (keeps dev compile fast). */
export function isDemoAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';
}
