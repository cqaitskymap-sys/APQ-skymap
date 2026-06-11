'use client';

import { MonitoringEntityList } from '@/components/monitoring-mgmt/monitoring-entity-list';
import { EnvironmentalForm } from '@/components/monitoring-mgmt/monitoring-forms';
import { MonitoringStatusBadge } from '@/components/monitoring-mgmt/monitoring-sub-nav';
import { useMonitoring } from '@/hooks/use-monitoring-mgmt';
import { exportEnvironmentalCsv } from '@/lib/monitoring-mgmt-service';

export default function EnvironmentalMonitoringPage() {
  const { areas, environmental, loading, refresh } = useMonitoring();

  return (
    <MonitoringEntityList
      title="Environmental Monitoring"
      description="Record temperature, humidity, differential pressure, and microbial monitoring data"
      records={environmental as unknown as Record<string, unknown>[]}
      loading={loading}
      mode="environmental"
      onRefresh={refresh}
      exportFn={() => exportEnvironmentalCsv(environmental)}
      renderForm={(props) => <EnvironmentalForm areas={areas} {...props} />}
      columns={[
        { key: 'monitoring_number', label: 'No' },
        { key: 'monitoring_date', label: 'Date' },
        { key: 'area_name', label: 'Area' },
        { key: 'monitoring_type', label: 'Type' },
        { key: 'observed_value', label: 'Value', render: (r) => `${r.observed_value} ${r.unit || ''}` },
        { key: 'status', label: 'Status', render: (r) => <MonitoringStatusBadge status={String(r.status)} /> },
      ]}
    />
  );
}
