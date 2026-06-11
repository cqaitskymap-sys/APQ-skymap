'use client';

import { PlaceholderPage } from '@/components/layout/placeholder-page';

const SECTIONS = {
  batches: { title: 'Batch Review', description: 'Review manufacturing batches linked to the Product Quality Review.' },
  materials: { title: 'Material Review', description: 'Review raw materials, APIs, and excipients for the PQR period.' },
  packaging: { title: 'Packaging Review', description: 'Review packaging components and vendor performance for PQR.' },
  'equipment-review': { title: 'Equipment Review', description: 'Review equipment qualification, calibration, and maintenance records.' },
  stability: { title: 'Stability Review', description: 'Review stability study data and trending for the review period.' },
  summary: { title: 'Summary & Conclusion', description: 'Compile PQR summary, conclusions, and recommendations.' },
  approval: { title: 'PQR Approval', description: 'Route PQR through review and approval workflow with e-signatures.' },
} as const;

export type PqrSectionKey = keyof typeof SECTIONS;

export function PqrSectionPage({ section }: { section: PqrSectionKey }) {
  const meta = SECTIONS[section];
  return (
    <PlaceholderPage
      title={meta.title}
      description={meta.description}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'PQR Management', href: '/dashboard/pqr' },
        { label: meta.title },
      ]}
      backHref="/dashboard/pqr"
      backLabel="Back to PQR Dashboard"
    />
  );
}
