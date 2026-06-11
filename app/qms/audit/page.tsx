'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck, Calendar, CheckCircle, AlertTriangle, XCircle, Link2, Clock, Download, Eye, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuditDashboardCharts } from '@/components/audit-mgmt/audit-dashboard-charts';
import { AuditFiltersBar } from '@/components/audit-mgmt/audit-filters';
import { AuditStatusBadge } from '@/components/audit-mgmt/audit-sub-nav';
import { useAudits } from '@/hooks/use-audit-mgmt';
import { exportAuditsCsv } from '@/lib/audit-mgmt-service';
import type { AuditFilters } from '@/lib/audit-mgmt-types';
import { cn } from '@/lib/utils';

export default function AuditDashboardPage() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const { audits, findings, metrics, loading, error } = useAudits(filters);

  const kpiCards = metrics ? [
    { label: 'Total Audits', value: metrics.total, icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Planned Audits', value: metrics.planned, icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Completed Audits', value: metrics.completed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Open Findings', value: metrics.openFindings, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Closed Findings', value: metrics.closedFindings, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Critical Findings', value: metrics.criticalFindings, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'CAPA Required', value: metrics.capaRequired, icon: Link2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Overdue Findings', value: metrics.overdueFindings, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant audit management for internal, supplier, regulatory, and self-inspection audits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportAuditsCsv(audits)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/audit/create"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Create Audit</Button></Link>
        </div>
      </div>
      <AuditFiltersBar filters={filters} onChange={setFilters} />
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
          <AuditDashboardCharts audits={audits} findings={findings} />
          <Card><CardHeader><CardTitle>Audit Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
              <TableHead>Department</TableHead><TableHead>Date</TableHead><TableHead>Findings</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {audits.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No audits found</TableCell></TableRow>
                : audits.slice(0, 15).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.audit_number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{a.audit_title}</TableCell>
                    <TableCell className="text-xs">{a.audit_type}</TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>{a.audit_date}</TableCell>
                    <TableCell>{a.total_findings}</TableCell>
                    <TableCell><AuditStatusBadge status={a.status} /></TableCell>
                    <TableCell><Link href={`/qms/audit/${a.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
