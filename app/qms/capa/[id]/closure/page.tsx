import { CapaClosurePage } from '@/components/capa/closure/capa-closure-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaClosurePage capaId={params.id} />;
}
