import { redirect } from 'next/navigation';

export default function PqrBatchesRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/pqr/${params.id}/batches`);
}
