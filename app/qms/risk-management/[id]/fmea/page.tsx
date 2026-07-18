import { RiskFmeaPage } from '@/components/risk-management/fmea/risk-fmea-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RiskFmeaPage riskAssessmentId={params.id} />;
}
