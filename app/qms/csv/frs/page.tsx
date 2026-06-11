'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { FrsForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function FrsPage() {
  const { frs, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="Functional Requirement Specification (FRS)" description="Functional specifications linked to URS requirements"
      records={frs as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'frs_id', label: 'FRS ID' },
        { key: 'system_name', label: 'System' },
        { key: 'linked_urs_no', label: 'URS No' },
        { key: 'status', label: 'Status' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <FrsForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
