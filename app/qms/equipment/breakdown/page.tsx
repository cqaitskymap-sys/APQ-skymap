'use client';

import { EquipmentEntityList } from '@/components/equipment-mgmt/equipment-entity-list';
import { BreakdownForm } from '@/components/equipment-mgmt/equipment-forms';
import { useEquipment } from '@/hooks/use-equipment-mgmt';

export default function BreakdownMaintenancePage() {
  const { equipment, breakdowns, loading, refresh } = useEquipment({});

  return (
    <EquipmentEntityList
      title="Breakdown Maintenance"
      description="Report equipment breakdowns, downtime, and link to deviation/CAPA"
      records={breakdowns as unknown as Record<string, unknown>[]}
      loading={loading}
      equipment={equipment}
      onRefresh={refresh}
      allowBreakdown
      renderForm={(props) => <BreakdownForm {...props} />}
      columns={[
        { key: 'breakdown_no', label: 'Breakdown No' },
        { key: 'equipment_name', label: 'Equipment' },
        { key: 'breakdown_date', label: 'Date' },
        { key: 'reported_by_name', label: 'Reported By' },
        { key: 'downtime_hours', label: 'Downtime (h)' },
        { key: 'status', label: 'Status' },
        { key: 'linked_deviation_number', label: 'Deviation', render: (r) => String(r.linked_deviation_number || '—') },
      ]}
    />
  );
}
