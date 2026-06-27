import { CcImplementationPage } from '@/components/change-control/implementation/cc-implementation-page';

export default async function ChangeImplementationPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CcImplementationPage changeId={id} />;
}
