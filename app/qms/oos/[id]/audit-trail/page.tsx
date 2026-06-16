import { OosAuditTrailView } from '@/components/oos/audit-trail/oos-audit-trail-view';

export default function Page({ params }: { params: { id: string } }) {
  return <OosAuditTrailView oosId={params.id} />;
}
