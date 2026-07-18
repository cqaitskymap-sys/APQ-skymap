import { ComplaintImpactPage } from '@/components/complaints/impact-assessment/complaint-impact-page';

export default async function ComplaintImpactAssessmentRoute(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ComplaintImpactPage complaintId={params.id} />;
}
