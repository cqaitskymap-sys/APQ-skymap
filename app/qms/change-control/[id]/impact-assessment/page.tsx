import { CcImpactPage } from '@/components/change-control/impact-assessment/cc-impact-page';

export default async function ChangeImpactAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CcImpactPage changeId={id} />;
}
