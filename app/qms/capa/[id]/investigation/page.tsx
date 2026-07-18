import { CapaInvestigationPage } from '@/components/capa/investigation/capa-investigation-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaInvestigationPage capaId={params.id} />;
}
