'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MonitoringDetailView } from '@/components/monitoring-mgmt/monitoring-detail-view';
import { useAreaItem } from '@/hooks/use-monitoring-mgmt';

export default function MonitoringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { record, loading, refresh } = useAreaItem(id);

  if (loading) return <LoadingSpinner />;
  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Area not found</p>
        <Link href="/qms/monitoring"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Back to Dashboard</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/qms/monitoring/area-master"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back to Area Master</Button></Link>
      <MonitoringDetailView area={record} onRefresh={refresh} />
    </div>
  );
}
