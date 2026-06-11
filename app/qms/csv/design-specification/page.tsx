'use client';

import { CsvEntityList } from '@/components/csv-mgmt/csv-entity-list';
import { DesignSpecForm } from '@/components/csv-mgmt/csv-forms';
import { useCsvSystems } from '@/hooks/use-csv-mgmt';

export default function DesignSpecPage() {
  const { designSpecs, loading, refresh } = useCsvSystems({});
  return (
    <CsvEntityList title="Design Specification" description="Technical design linked to FRS requirements"
      records={designSpecs as unknown as Record<string, unknown>[]} loading={loading} onRefresh={refresh}
      columns={[
        { key: 'ds_id', label: 'DS ID' },
        { key: 'system_name', label: 'System' },
        { key: 'linked_frs_no', label: 'FRS No' },
        { key: 'status', label: 'Status' },
      ]}
      renderForm={({ systems, onSuccess, onClose }) => <DesignSpecForm systems={systems} onSuccess={onSuccess} onClose={onClose} />}
    />
  );
}
