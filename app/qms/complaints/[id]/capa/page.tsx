import { ComplaintCapaPage } from '@/components/complaints/capa-link/complaint-capa-page';

export default async function ComplaintCapaRoute(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ComplaintCapaPage complaintId={params.id} />;
}
