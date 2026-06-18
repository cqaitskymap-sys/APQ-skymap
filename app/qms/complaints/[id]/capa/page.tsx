import { ComplaintCapaPage } from '@/components/complaints/capa-link/complaint-capa-page';

export default function ComplaintCapaRoute({ params }: { params: { id: string } }) {
  return <ComplaintCapaPage complaintId={params.id} />;
}
