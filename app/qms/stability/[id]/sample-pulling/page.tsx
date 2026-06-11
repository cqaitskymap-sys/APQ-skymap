'use client';

import { StabilityDetailView } from '@/components/stability/stability-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useStabilityStudy } from '@/hooks/use-stability';

export default function StudySamplePullingPage({ params }: { params: { id: string } }) {
  const { record, loading, refresh } = useStabilityStudy(params.id);
  if (loading) return <LoadingSpinner />;
  if (!record) return <p className="text-muted-foreground">Not found.</p>;
  return <StabilityDetailView record={record} onRefresh={refresh} defaultTab="pulling" />;
}
