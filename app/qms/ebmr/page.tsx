'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText, FileEdit, Factory, ClipboardCheck, CheckCircle, PauseCircle, XCircle, AlertTriangle, Download, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EbmrDashboardCharts } from '@/components/ebmr-mgmt/ebmr-dashboard-charts';
import { EbmrFiltersBar } from '@/components/ebmr-mgmt/ebmr-filters';
import { EbmrRecordsTable } from '@/components/ebmr-mgmt/ebmr-entity-list';
import { useEbmr } from '@/hooks/use-ebmr-mgmt';
import { exportEbmrCsv } from '@/lib/ebmr-mgmt-service';
import type { EbmrFilters } from '@/lib/ebmr-mgmt-types';
import { cn } from '@/lib/utils';

export default function EbmrDashboardPage() {
  const [filters, setFilters] = useState<EbmrFilters>({});
  const { records, cppRecords, ipcRecords, mfgSteps, metrics, loading, error } = useEbmr(filters);

  const kpiCards = metrics ? [
    { label: 'Total eBMR', value: metrics.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Draft Batches', value: metrics.draft, icon: FileEdit, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'In Progress', value: metrics.inProgress, icon: Factory, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'QA Review Pending', value: metrics.qaReviewPending, icon: ClipboardCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Released', value: metrics.released, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Hold', value: metrics.hold, icon: PauseCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Rejected', value: metrics.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Deviation Linked', value: metrics.deviationLinked, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">eBMR Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP Electronic Batch Manufacturing Record for injectable product manufacturing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportEbmrCsv(records)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/ebmr/create"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create Batch Record</Button></Link>
        </div>
      </div>
      <EbmrFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <EbmrDashboardCharts records={records} cppRecords={cppRecords} ipcRecords={ipcRecords} mfgSteps={mfgSteps} />
          <Card><CardHeader><CardTitle>Batch Records</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <EbmrRecordsTable records={records} />
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
