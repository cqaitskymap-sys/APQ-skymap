'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Download, Eye, FileText, Clock, CheckCircle, Archive, AlertTriangle, GraduationCap, GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DmsDashboardCharts } from '@/components/dms/dms-dashboard-charts';
import { DmsFiltersBar } from '@/components/dms/dms-filters';
import { DmsStatusBadge, DmsTypeBadge } from '@/components/dms/dms-sub-nav';
import { useDocuments } from '@/hooks/use-dms';
import { exportDocumentsCsv } from '@/lib/dms-service';
import type { DmsFilters } from '@/lib/dms-types';
import { cn } from '@/lib/utils';

export default function DmsDashboardPage() {
  const [filters, setFilters] = useState<DmsFilters>({});
  const { records, metrics, loading, error } = useDocuments(filters);

  const kpiCards = metrics ? [
    { label: 'Total Documents', value: metrics.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Draft Documents', value: metrics.draft, icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Under Review', value: metrics.underReview, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Effective Documents', value: metrics.effective, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Obsolete Documents', value: metrics.obsolete, icon: Archive, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'Review Due', value: metrics.reviewDue, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Training Pending', value: metrics.trainingPending, icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Recent Revisions', value: metrics.recentRevisions, icon: GitBranch, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">DMS Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant document lifecycle management for SOP, BMR, PQR, CPV and QMS documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportDocumentsCsv(records)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/dms/create"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create Document</Button></Link>
        </div>
      </div>
      <DmsFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <DmsDashboardCharts records={records} />
          <Card><CardHeader><CardTitle>Recent Documents</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
              <TableHead>Department</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {records.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No documents found</TableCell></TableRow>
                : records.slice(0, 15).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.document_number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.document_title}</TableCell>
                    <TableCell><DmsTypeBadge type={r.document_type} /></TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell>{r.version}</TableCell>
                    <TableCell><DmsStatusBadge status={r.status} /></TableCell>
                    <TableCell><Link href={`/qms/dms/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
