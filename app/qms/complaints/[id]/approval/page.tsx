import { ComplaintApprovalPage } from '@/components/complaints/approval/complaint-approval-page';

export default function ComplaintApprovalRoute({ params }: { params: { id: string } }) {
  return <ComplaintApprovalPage complaintId={params.id} />;
}
