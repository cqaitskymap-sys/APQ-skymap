import { CcApprovalPage } from '@/components/change-control/approval/cc-approval-page';

export default async function ChangeApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CcApprovalPage changeId={id} />;
}
