'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { ValidationReportForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function ValidationReportPage() {
  const { validationReports, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="CSV Validation Report" description="Final validation summary with requirement coverage and conclusion"
      records={validationReports as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'system_name', label: 'System' },
        { key: 'requirement_coverage_percent', label: 'Coverage %' },
        { key: 'final_conclusion', label: 'Conclusion' },
        { key: 'recommended_status', label: 'Status' },
        { key: 'approved_by_name', label: 'Approved By' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <ValidationReportForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
