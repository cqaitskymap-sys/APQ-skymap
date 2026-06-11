'use client';

import { EquipmentEntityList } from '@/components/equipment-mgmt/equipment-entity-list';
import { PmForm } from '@/components/equipment-mgmt/equipment-forms';
import { EquipmentStatusBadge } from '@/components/equipment-mgmt/equipment-sub-nav';
import { useEquipment } from '@/hooks/use-equipment-mgmt';

export default function PreventiveMaintenancePage() {
  const { equipment, pmRecords, loading, refresh } = useEquipment({});

  return (
    <EquipmentEntityList
      title="Preventive Maintenance"
      description="Schedule and record PM activities with checklists and spare parts"
      records={pmRecords as unknown as Record<string, unknown>[]}
      loading={loading}
      equipment={equipment}
      onRefresh={refresh}
      renderForm={(props) => <PmForm {...props} />}
      columns={[
        { key: 'pm_record_no', label: 'PM No' },
        { key: 'equipment_name', label: 'Equipment' },
        { key: 'pm_type', label: 'Type' },
        { key: 'pm_date', label: 'Date' },
        { key: 'next_pm_due_date', label: 'Next Due' },
        { key: 'pm_status', label: 'Status', render: (r) => <EquipmentStatusBadge status={String(r.pm_status)} /> },
      ]}
    />
  );
}
