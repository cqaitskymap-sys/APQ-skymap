import { CapaAuditTrailView } from '@/components/capa/audit-trail/capa-audit-trail-view';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CapaAuditTrailView capaId={params.id} />;
}
