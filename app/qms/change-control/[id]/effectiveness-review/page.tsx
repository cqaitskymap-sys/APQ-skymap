import { CcEffectivenessPage } from '@/components/change-control/effectiveness/cc-effectiveness-page';

export default async function ChangeEffectivenessReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CcEffectivenessPage changeId={id} />;
}
