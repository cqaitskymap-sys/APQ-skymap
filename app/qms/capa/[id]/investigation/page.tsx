import { CapaInvestigationPage } from '@/components/capa/investigation/capa-investigation-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaInvestigationPage capaId={params.id} />;
}
