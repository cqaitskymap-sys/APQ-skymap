'use client';;
import { use } from "react";

import { StabilityDetailView } from '@/components/stability/stability-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useStabilityStudy } from '@/hooks/use-stability';

export default function StudySchedulePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { record, loading, refresh } = useStabilityStudy(params.id);
  if (loading) return <LoadingSpinner />;
  if (!record) return <p className="text-muted-foreground">Not found.</p>;
  return <StabilityDetailView record={record} onRefresh={refresh} defaultTab="schedule" />;
}
