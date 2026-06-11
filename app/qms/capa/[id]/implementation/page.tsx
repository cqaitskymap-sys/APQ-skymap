import { redirect } from 'next/navigation';

export default function CapaImplementationRedirect({ params }: { params: { id: string } }) {
  redirect(`/qms/capa/${params.id}`);
}
