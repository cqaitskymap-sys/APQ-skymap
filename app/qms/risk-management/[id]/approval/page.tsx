import { RiskApprovalPage } from '@/components/risk-management/approval/risk-approval-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RiskApprovalPage riskAssessmentId={params.id} />;
}
