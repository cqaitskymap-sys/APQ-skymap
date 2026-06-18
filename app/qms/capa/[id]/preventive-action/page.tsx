import { CapaPreventiveActionPage } from '@/components/capa/preventive-action/capa-preventive-action-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaPreventiveActionPage capaId={params.id} />;
}
