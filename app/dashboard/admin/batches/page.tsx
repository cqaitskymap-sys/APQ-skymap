import { redirect } from 'next/navigation';

export default function LegacyBatchesRedirect() {
  redirect('/admin/batches');
}
