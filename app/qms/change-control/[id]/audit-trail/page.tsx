import { CcAuditTrailView } from '@/components/change-control/audit-trail/cc-audit-trail-view';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CcAuditTrailView changeId={params.id} />;
}
