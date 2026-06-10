'use client';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminDashboardCharts } from '@/components/admin/admin-dashboard-charts';

export default function AdminDashboardPage() {
  return (
    <div>
      <AdminPageHeader
        title="Admin Dashboard"
        description="System overview, compliance metrics, and operational health for Pharma QMS"
      />
      <AdminDashboardCharts />
    </div>
  );
}
