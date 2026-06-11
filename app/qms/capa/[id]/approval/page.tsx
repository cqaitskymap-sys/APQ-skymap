import { redirect } from 'next/navigation';

export default function CapaApprovalRedirect({ params }: { params: { id: string } }) {
  redirect(`/qms/capa/${params.id}`);
}
