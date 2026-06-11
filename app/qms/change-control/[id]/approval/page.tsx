'use client';

import { CcDetailView } from '@/components/change-control/cc-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useChangeControl } from '@/hooks/use-change-control';

export default function ChangeApprovalPage({ params }: { params: { id: string } }) {
  const { record, loading, refresh } = useChangeControl(params.id);
  if (loading) return <LoadingSpinner />;
  if (!record) return <p className="text-muted-foreground">Not found.</p>;
  return <CcDetailView record={record} onRefresh={refresh} defaultTab="approval" />;
}
