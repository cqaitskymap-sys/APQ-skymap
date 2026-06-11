'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VendorDetailView } from '@/components/vendor-mgmt/vendor-detail-view';
import { useVendor } from '@/hooks/use-vendor-mgmt';

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { record, loading, refresh } = useVendor(id);

  if (loading) return <LoadingSpinner />;
  if (!record) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Vendor not found</p>
        <Link href="/qms/vendors/master"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Back to Vendor Master</Button></Link>
      </div>
    );
  }

  return <VendorDetailView record={record} onRefresh={refresh} />;
}
