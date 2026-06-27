import { CcValidationPage } from '@/components/change-control/validation-assessment/cc-validation-page';

export default async function ChangeValidationAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CcValidationPage changeId={id} />;
}
