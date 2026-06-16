import {
  fetchSystemSettings,
  validateFileAgainstSettings,
} from '@/lib/admin/system-settings-service';

/**
 * Validates a file upload against global system settings.
 * Returns user-friendly error message when blocked.
 */
export async function validateFileUpload(file: File): Promise<{ ok: boolean; error?: string }> {
  const settings = await fetchSystemSettings();
  const result = validateFileAgainstSettings(file, settings);
  return { ok: result.allowed, error: result.error };
}
