import { CcRiskPage } from '@/components/change-control/risk-assessment/cc-risk-page';

export default async function ChangeRiskAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CcRiskPage changeId={id} />;
}
