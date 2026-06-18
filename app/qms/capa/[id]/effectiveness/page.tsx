import { CapaEffectivenessPage } from '@/components/capa/effectiveness/capa-effectiveness-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaEffectivenessPage capaId={params.id} />;
}
