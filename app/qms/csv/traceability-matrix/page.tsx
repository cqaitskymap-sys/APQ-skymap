'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { TraceabilityForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';
import { calcTraceabilityCoverage } from '@/lib/csv-mgmt-types';

export default function TraceabilityPage() {
  const { traceability, loading, refresh } = useCsvSystems({});
  const coverage = calcTraceabilityCoverage(traceability);
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
        <p className="text-sm text-blue-800">Overall Traceability Coverage: <strong>{coverage}%</strong></p>
      </div>
      <CsvEntityList title="Traceability Matrix" description="URS → FRS → DS → IQ/OQ/PQ requirement traceability"
        records={traceability as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
        columns={[
          { key: 'system_name', label: 'System' },
          { key: 'urs_no', label: 'URS' },
          { key: 'frs_no', label: 'FRS' },
          { key: 'ds_no', label: 'DS' },
          { key: 'gap_identified', label: 'Gap', render: (r) => r.gap_identified ? 'Yes' : 'No' },
        ]}
        renderForm={({ systems, onSuccess, onClose }) => <TraceabilityForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
      />
    </div>
  );
}
