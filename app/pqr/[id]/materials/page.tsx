import { redirect } from 'next/navigation';

export default function PqrMaterialsRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/pqr/${params.id}/materials`);
}
