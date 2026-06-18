import { ComplaintImpactPage } from '@/components/complaints/impact-assessment/complaint-impact-page';

export default function ComplaintImpactAssessmentRoute({ params }: { params: { id: string } }) {
  return <ComplaintImpactPage complaintId={params.id} />;
}
