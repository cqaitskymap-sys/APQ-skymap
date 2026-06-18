import { ComplaintInvestigationPageShell } from '@/components/complaints/investigation/complaint-investigation-page';

export default function ComplaintInvestigationRoute({ params }: { params: { id: string } }) {
  return <ComplaintInvestigationPageShell complaintId={params.id} />;
}
