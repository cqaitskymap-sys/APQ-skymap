import { redirect } from 'next/navigation';

export default function LegacySystemSettingsRedirect() {
  redirect('/admin/system-settings');
}
