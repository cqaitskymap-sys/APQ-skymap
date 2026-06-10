import { redirect } from 'next/navigation';

export default function PqrDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/pqr/${params.id}`);
}
