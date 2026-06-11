'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EquipmentDetailView } from '@/components/equipment-mgmt/equipment-detail-view';
import { useEquipmentItem } from '@/hooks/use-equipment-mgmt';

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { record, loading, refresh } = useEquipmentItem(id);

  if (loading) return <LoadingSpinner />;
  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Equipment not found</p>
        <Link href="/qms/equipment"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Back to Dashboard</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/qms/equipment/master"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back to Master</Button></Link>
      <EquipmentDetailView equipment={record} onRefresh={refresh} />
    </div>
  );
}
