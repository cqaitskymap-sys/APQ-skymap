import { RiskFmeaPage } from '@/components/risk-management/fmea/risk-fmea-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RiskFmeaPage riskAssessmentId={params.id} />;
}
