import { DeviationImpactPage } from '@/components/deviations/impact-assessment/deviation-impact-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <DeviationImpactPage deviationId={params.id} />;
}
