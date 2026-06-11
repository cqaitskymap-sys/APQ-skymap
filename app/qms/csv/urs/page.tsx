'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { UrsForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function UrsPage() {
  const { urs, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="User Requirement Specification (URS)" description="Functional and GxP requirements for computerized systems"
      records={urs as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'urs_id', label: 'URS ID' },
        { key: 'system_name', label: 'System' },
        { key: 'requirement_no', label: 'Req No' },
        { key: 'requirement_type', label: 'Type' },
        { key: 'status', label: 'Status' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <UrsForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
