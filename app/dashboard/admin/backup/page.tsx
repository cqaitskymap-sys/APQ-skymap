import { redirect } from 'next/navigation';

export default function LegacyBackupRedirect() {
  redirect('/admin/backup');
}
