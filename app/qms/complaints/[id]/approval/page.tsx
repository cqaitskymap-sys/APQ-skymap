import { ComplaintApprovalPage } from '@/components/complaints/approval/complaint-approval-page';

export default async function ComplaintApprovalRoute(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ComplaintApprovalPage complaintId={params.id} />;
}
