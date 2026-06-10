'use client';

import { PlaceholderPage } from '@/components/layout/placeholder-page';

export default function ReportsPage() {
  return (
    <PlaceholderPage
      title="Reports"
      description="QMS analytics and regulatory reports module."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports' },
      ]}
    />
  );
}
