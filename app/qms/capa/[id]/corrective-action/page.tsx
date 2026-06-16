import { CapaCorrectiveActionPage } from '@/components/capa/corrective-action/capa-corrective-action-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaCorrectiveActionPage capaId={params.id} />;
}
