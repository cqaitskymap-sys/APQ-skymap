import { OosAuditTrailView } from '@/components/oos/audit-trail/oos-audit-trail-view';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <OosAuditTrailView oosId={params.id} />;
}
