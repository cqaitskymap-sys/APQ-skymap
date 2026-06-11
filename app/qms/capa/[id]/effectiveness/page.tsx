import { redirect } from 'next/navigation';

export default function CapaEffectivenessRedirect({ params }: { params: { id: string } }) {
  redirect(`/qms/capa/${params.id}`);
}
