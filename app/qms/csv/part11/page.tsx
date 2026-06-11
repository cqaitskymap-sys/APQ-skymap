'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { Part11Form } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function Part11Page() {
  const { part11, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="21 CFR Part 11 Assessment" description="Electronic records and e-signatures compliance assessment"
      records={part11 as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'system_name', label: 'System' },
        { key: 'assessment_result', label: 'Result' },
        { key: 'gap_action', label: 'Gap Action' },
        { key: 'status', label: 'Status' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <Part11Form systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
