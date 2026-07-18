import { ComplaintInvestigationPageShell } from '@/components/complaints/investigation/complaint-investigation-page';

export default async function ComplaintInvestigationRoute(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ComplaintInvestigationPageShell complaintId={params.id} />;
}
