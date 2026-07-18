import { RiskApprovalPage } from '@/components/risk-management/approval/risk-approval-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RiskApprovalPage riskAssessmentId={params.id} />;
}
