import { CapaAuditTrailView } from '@/components/capa/audit-trail/capa-audit-trail-view';

export default function Page({ params }: { params: { id: string } }) {
  return <CapaAuditTrailView capaId={params.id} />;
}
