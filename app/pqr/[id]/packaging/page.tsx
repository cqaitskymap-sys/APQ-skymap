'use client';

import { PlaceholderPage } from '@/components/layout/placeholder-page';

export default function PqrPackagingPage() {
  return (
    <PlaceholderPage
      title="PQR Packaging Review"
      description="Packaging review section for Product Quality Review."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'PQR', href: '/dashboard/pqr' },
        { label: 'Packaging Review' },
      ]}
      backHref="/dashboard/packaging"
      backLabel="Go to Packaging Module"
    />
  );
}
