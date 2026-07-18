import { CapaClosurePage } from '@/components/capa/closure/capa-closure-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaClosurePage capaId={params.id} />;
}
