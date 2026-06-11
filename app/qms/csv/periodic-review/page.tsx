'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { PeriodicReviewForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function PeriodicReviewPage() {
  const { periodicReviews, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="Periodic Review" description="Scheduled CSV periodic reviews for validated systems"
      records={periodicReviews as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'system_name', label: 'System' },
        { key: 'review_period', label: 'Period' },
        { key: 'validation_status', label: 'Val Status' },
        { key: 'recommendation', label: 'Recommendation' },
        { key: 'next_review_due', label: 'Next Due' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <PeriodicReviewForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
