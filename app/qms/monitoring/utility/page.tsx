'use client';

import { MonitoringEntityList } from '@/components/monitoring-mgmt/monitoring-entity-list';
import { UtilityForm } from '@/components/monitoring-mgmt/monitoring-forms';
import { MonitoringStatusBadge } from '@/components/monitoring-mgmt/monitoring-sub-nav';
import { useMonitoring } from '@/hooks/use-monitoring-mgmt';
import { exportUtilityCsv } from '@/lib/monitoring-mgmt-service';

export default function UtilityMonitoringPage() {
  const { utility, loading, refresh } = useMonitoring();

  return (
    <MonitoringEntityList
      title="Utility Monitoring"
      description="Monitor purified water, WFI, compressed air, HVAC, and utility system parameters"
      records={utility as unknown as Record<string, unknown>[]}
      loading={loading}
      mode="utility"
      onRefresh={refresh}
      exportFn={() => exportUtilityCsv(utility)}
      renderForm={(props) => <UtilityForm {...props} />}
      columns={[
        { key: 'utility_record_no', label: 'Record No' },
        { key: 'monitoring_date', label: 'Date' },
        { key: 'utility_type', label: 'Utility Type' },
        { key: 'sampling_point', label: 'Sampling Point' },
        { key: 'parameter_name', label: 'Parameter' },
        { key: 'observed_value', label: 'Value', render: (r) => `${r.observed_value} ${r.unit || ''}` },
        { key: 'status', label: 'Status', render: (r) => <MonitoringStatusBadge status={String(r.status)} /> },
      ]}
    />
  );
}
