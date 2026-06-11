'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { TestScriptForm } from '@/components/csv-mgmt/csv-forms';
import { PassFailBadge } from '@/components/csv-mgmt/csv-sub-nav';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function PqPage() {
  const { testScripts, loading, refresh } = useCsvSystems({});
  const filtered = testScripts.filter((t) => t.test_phase === 'PQ');
  return (
    <CsvEntityList title="Performance Qualification (PQ)" description="PQ/UAT test scripts and execution records"
      records={filtered as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'test_script_no', label: 'Script #' },
        { key: 'system_name', label: 'System' },
        { key: 'pass_fail', label: 'Result', render: (r) => <PassFailBadge result={String(r.pass_fail)} /> },
        { key: 'execution_date', label: 'Date' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <TestScriptForm systems={systems} onSuccess={onSuccess} onClose={onClose} phase="PQ" />}
    />
  );
}
