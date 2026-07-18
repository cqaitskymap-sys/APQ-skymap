import { CapaApprovalPage } from '@/components/capa/approval/capa-approval-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaApprovalPage capaId={params.id} />;
}
