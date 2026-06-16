'use client';

import { CompanySiteAccessGuard } from '@/components/admin/company-sites/company-site-access-guard';
import { CompanySitesListPage } from '@/components/admin/company-sites/company-sites-list-page';

export default function AdminCompanySitePage() {
  return (
    <CompanySiteAccessGuard>
      <CompanySitesListPage />
    </CompanySiteAccessGuard>
  );
}
