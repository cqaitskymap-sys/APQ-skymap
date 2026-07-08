import { isFirebaseConfigured } from '@/lib/firebase';

const CIRCUIT_COOLDOWN_MS = 60_000;
const QUERY_TIMEOUT_MS = 8_000;

let firestoreCircuitOpenUntil = 0;

/** Skip Firestore when offline or circuit breaker is open after recent failures. */
export function shouldSkipFirestore(): boolean {
  if (!isFirebaseConfigured()) return true;
  if (typeof window !== 'undefined' && !navigator.onLine) return true;
  return Date.now() < firestoreCircuitOpenUntil;
}

export function markFirestoreUnavailable(): void {
  firestoreCircuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
}

export function resetFirestoreCircuit(): void {
  firestoreCircuitOpenUntil = 0;
}

/**
 * Run a Firestore query with timeout + circuit breaker.
 * Returns fallback silently on network/DNS/QUIC errors (no console spam from retries).
 */
export async function withFirestoreFallback<T>(
  queryFn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (shouldSkipFirestore()) return fallback;

  try {
    const result = await Promise.race([
      queryFn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Firestore query timeout')), QUERY_TIMEOUT_MS);
      }),
    ]);
    return result;
  } catch {
    markFirestoreUnavailable();
    return fallback;
  }
}

/** Listen for browser coming back online to reset circuit breaker. */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => resetFirestoreCircuit());
}
