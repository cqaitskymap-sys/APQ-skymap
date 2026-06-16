import { redirect } from 'next/navigation';

export default function LegacyDataBackupLogRedirect() {
  redirect('/admin/backup/history');
}
