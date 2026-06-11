'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Download, Eye, MessageSquare, Clock, CheckCircle, AlertTriangle, Link2, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ComplaintDashboardCharts } from '@/components/complaints/complaint-dashboard-charts';
import { ComplaintFiltersBar } from '@/components/complaints/complaint-filters';
import { ComplaintStatusBadge, CriticalityBadge } from '@/components/complaints/complaint-sub-nav';
import { useComplaints } from '@/hooks/use-complaint';
import { exportComplaintsCsv } from '@/lib/complaint-service';
import type { ComplaintFilters } from '@/lib/complaint-types';
import { cn } from '@/lib/utils';

export default function ComplaintsDashboardPage() {
  const [filters, setFilters] = useState<ComplaintFilters>({});
  const { records, metrics, loading, error } = useComplaints(filters);

  const kpiCards = metrics ? [
    { label: 'Total Complaints', value: metrics.total, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Complaints', value: metrics.open, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Closed Complaints', value: metrics.closed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Critical Complaints', value: metrics.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'CAPA Linked', value: metrics.capaLinked, icon: Link2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Overdue', value: metrics.overdue, icon: Flame, color: 'text-red-600', bg: 'bg-red-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Complaint Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant market complaint management linked to CAPA, Recall, and PQR</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportComplaintsCsv(records)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/complaints/create"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Register Complaint</Button></Link>
        </div>
      </div>
      <ComplaintFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <ComplaintDashboardCharts records={records} />
          <Card><CardHeader><CardTitle>Complaint Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Customer</TableHead>
              <TableHead>Category</TableHead><TableHead>Criticality</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {records.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No complaints found</TableCell></TableRow>
                : records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.complaint_number}</TableCell>
                    <TableCell>{r.complaint_date}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{r.product_name}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell className="text-xs">{r.complaint_category}</TableCell>
                    <TableCell><CriticalityBadge value={r.complaint_criticality} /></TableCell>
                    <TableCell><ComplaintStatusBadge status={r.status} /></TableCell>
                    <TableCell><Link href={`/qms/complaints/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
