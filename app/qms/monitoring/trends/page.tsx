'use client';

import { MonitoringDashboardCharts } from '@/components/monitoring-mgmt/monitoring-dashboard-charts';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useMonitoring } from '@/hooks/use-monitoring-mgmt';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MonitoringTrendsPage() {
  const { areas, environmental, utility, excursions, loading } = useMonitoring();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Trend Analysis</h1>
          <p className="text-muted-foreground text-sm">Environmental and utility parameter trends — synced with CPV Trend Analysis</p>
        </div>
        <Link href="/cpv/trend-analysis"><Button variant="outline">Open CPV Trend Analysis →</Button></Link>
      </div>
      {loading ? <LoadingSpinner /> : (
        <MonitoringDashboardCharts environmental={environmental} utility={utility} excursions={excursions} areas={areas} />
      )}
    </div>
  );
}
