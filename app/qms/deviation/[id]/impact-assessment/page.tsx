import { DeviationImpactPage } from '@/components/deviations/impact-assessment/deviation-impact-page';

export default function Page({ params }: { params: { id: string } }) {
  return <DeviationImpactPage deviationId={params.id} />;
}
