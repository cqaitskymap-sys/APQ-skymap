'use client';

import { CompanySiteAccessGuard } from '@/components/admin/company-sites/company-site-access-guard';
import { CompanySiteDetailView } from '@/components/admin/company-sites/company-site-detail-view';

export default function CompanySiteDetailPage({ params }: { params: { id: string } }) {
  return (
    <CompanySiteAccessGuard>
      <CompanySiteDetailView id={params.id} />
    </CompanySiteAccessGuard>
  );
}
