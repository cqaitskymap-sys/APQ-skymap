'use client';

import { CcDetailView } from '@/components/change-control/cc-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useChangeControl } from '@/hooks/use-change-control';

export default function ChangeControlDetailPage({ params }: { params: { id: string } }) {
  const { record, loading, refresh } = useChangeControl(params.id);

  if (loading) return <LoadingSpinner label="Loading change control..." />;
  if (!record) return <p className="text-muted-foreground">Change control record not found.</p>;

  return <CcDetailView record={record} onRefresh={refresh} />;
}
