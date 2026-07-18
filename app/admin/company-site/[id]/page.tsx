'use client';;
import { use } from "react";

import { CompanySiteAccessGuard } from '@/components/admin/company-sites/company-site-access-guard';
import { CompanySiteDetailView } from '@/components/admin/company-sites/company-site-detail-view';

export default function CompanySiteDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <CompanySiteAccessGuard>
      <CompanySiteDetailView id={params.id} />
    </CompanySiteAccessGuard>
  );
}
