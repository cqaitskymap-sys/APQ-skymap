import { CapaEffectivenessPage } from '@/components/capa/effectiveness/capa-effectiveness-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaEffectivenessPage capaId={params.id} />;
}
