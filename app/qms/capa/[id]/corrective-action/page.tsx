import { CapaCorrectiveActionPage } from '@/components/capa/corrective-action/capa-corrective-action-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaCorrectiveActionPage capaId={params.id} />;
}
