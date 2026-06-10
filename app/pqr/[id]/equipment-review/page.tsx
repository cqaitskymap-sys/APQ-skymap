'use client';

import { PlaceholderPage } from '@/components/layout/placeholder-page';

export default function PqrEquipmentReviewPage() {
  return (
    <PlaceholderPage
      title="PQR Equipment Review"
      description="Equipment qualification review for Product Quality Review."
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'PQR', href: '/dashboard/pqr' },
        { label: 'Equipment Review' },
      ]}
      backHref="/dashboard/equipment"
      backLabel="Go to Equipment Module"
    />
  );
}
