'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CsvDetailView } from '@/components/csv-mgmt/csv-detail-view';
import { useCsvSystem } from '@/hooks/use-csv-mgmt';

export default function CsvDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { system, loading, refresh } = useCsvSystem(id);

  if (loading) return <LoadingSpinner />;
  if (!system) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">System not found</p>
        <Link href="/qms/csv/systems"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Back to Inventory</Button></Link>
      </div>
    );
  }

  return <CsvDetailView system={system} onRefresh={refresh} />;
}
