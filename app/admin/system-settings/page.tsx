import { redirect } from 'next/navigation';

export default function SystemSettingsIndexPage() {
  redirect('/admin/system-settings/general');
}
