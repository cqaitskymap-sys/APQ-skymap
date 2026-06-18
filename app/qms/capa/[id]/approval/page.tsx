import { CapaApprovalPage } from '@/components/capa/approval/capa-approval-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaApprovalPage capaId={params.id} />;
}
