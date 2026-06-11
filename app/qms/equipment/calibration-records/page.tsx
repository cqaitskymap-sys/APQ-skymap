'use client';

import { EquipmentEntityList } from '@/components/equipment-mgmt/equipment-entity-list';
import { CalibrationForm } from '@/components/equipment-mgmt/equipment-forms';
import { EquipmentStatusBadge } from '@/components/equipment-mgmt/equipment-sub-nav';
import { useEquipment } from '@/hooks/use-equipment-mgmt';
import { exportCalibrationsCsv } from '@/lib/equipment-mgmt-service';

export default function CalibrationRecordsPage() {
  const { equipment, calibrations, loading, refresh } = useEquipment({});

  return (
    <EquipmentEntityList
      title="Calibration Records"
      description="Record calibration activities, certificates, and acceptance criteria"
      records={calibrations as unknown as Record<string, unknown>[]}
      loading={loading}
      equipment={equipment}
      onRefresh={refresh}
      exportFn={() => exportCalibrationsCsv(calibrations)}
      renderForm={(props) => <CalibrationForm {...props} />}
      columns={[
        { key: 'calibration_record_no', label: 'Record No' },
        { key: 'equipment_name', label: 'Equipment' },
        { key: 'calibration_date', label: 'Date' },
        { key: 'calibration_due_date', label: 'Due Date' },
        { key: 'calibration_agency', label: 'Agency' },
        { key: 'calibration_status', label: 'Status', render: (r) => <EquipmentStatusBadge status={String(r.calibration_status)} /> },
      ]}
    />
  );
}
