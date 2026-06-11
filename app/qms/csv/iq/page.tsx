'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { TestScriptForm } from '@/components/csv-mgmt/csv-forms';
import { PassFailBadge } from '@/components/csv-mgmt/csv-sub-nav';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

function TestPage({ phase }: { phase: 'IQ' | 'OQ' | 'PQ' }) {
  const { testScripts, loading, refresh } = useCsvSystems({});
  const filtered = testScripts.filter((t) => t.test_phase === phase);
  const titles = { IQ: 'Installation Qualification (IQ)', OQ: 'Operational Qualification (OQ)', PQ: 'Performance Qualification (PQ)' };
  return (
    <CsvEntityList title={titles[phase]} description={`${phase} test scripts and execution records`}
      records={filtered as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'test_script_no', label: 'Script #' },
        { key: 'system_name', label: 'System' },
        { key: 'test_objective', label: 'Objective' },
        { key: 'pass_fail', label: 'Result', render: (r) => <PassFailBadge result={String(r.pass_fail)} /> },
        { key: 'executed_by_name', label: 'Executed By' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <TestScriptForm systems={systems} onSuccess={onSuccess} onClose={onClose} phase={phase} />}
    />
  );
}

export default function IqPage() { return <TestPage phase="IQ" />; }
