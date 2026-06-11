'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { GxpAssessmentForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function GxpAssessmentPage() {
  const { gxpAssessments, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="GxP Assessment" description="Determine GxP impact and classification for computerized systems"
      records={gxpAssessments as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'system_name', label: 'System' },
        { key: 'gxp_classification', label: 'Classification' },
        { key: 'assessment_date', label: 'Date' },
        { key: 'assessed_by_name', label: 'Assessed By' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <GxpAssessmentForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
