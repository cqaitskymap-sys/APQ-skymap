import { CapaPreventiveActionPage } from '@/components/capa/preventive-action/capa-preventive-action-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaPreventiveActionPage capaId={params.id} />;
}
