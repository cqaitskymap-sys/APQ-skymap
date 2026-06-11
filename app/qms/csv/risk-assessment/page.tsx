'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { RiskAssessmentForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function RiskAssessmentPage() {
  const { riskAssessments, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="CSV Risk Assessment" description="FMEA-based risk assessment with auto RPN calculation"
      records={riskAssessments as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'system_name', label: 'System' },
        { key: 'risk_description', label: 'Risk' },
        { key: 'rpn', label: 'RPN' },
        { key: 'risk_level', label: 'Level' },
        { key: 'approval_status', label: 'Status' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <RiskAssessmentForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
