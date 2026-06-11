'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2, CheckCircle, Clock, ShieldBan, AlertTriangle, FileWarning, Search, FileSignature, Download, Eye, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VendorDashboardCharts } from '@/components/vendor-mgmt/vendor-dashboard-charts';
import { VendorFiltersBar } from '@/components/vendor-mgmt/vendor-filters';
import { ApprovalBadge, RiskBadge } from '@/components/vendor-mgmt/vendor-sub-nav';
import { useVendors } from '@/hooks/use-vendor-mgmt';
import { exportVendorsCsv } from '@/lib/vendor-mgmt-service';
import type { VendorFilters } from '@/lib/vendor-mgmt-types';
import { cn } from '@/lib/utils';

export default function VendorDashboardPage() {
  const [filters, setFilters] = useState<VendorFilters>({});
  const { vendors, performance, metrics, loading, error } = useVendors(filters);

  const kpiCards = metrics ? [
    { label: 'Total Vendors', value: metrics.total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Approved', value: metrics.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Under Qualification', value: metrics.underQualification, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Blocked', value: metrics.blocked, icon: ShieldBan, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Expired', value: metrics.expired, icon: FileWarning, color: 'text-gray-600', bg: 'bg-gray-50' },
    { label: 'High Risk', value: metrics.highRisk, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Audit Due', value: metrics.auditDue, icon: Search, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Agreement Expired', value: metrics.agreementExpired, icon: FileSignature, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Conditional', value: metrics.conditional, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendor Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant vendor qualification and supplier management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportVendorsCsv(vendors)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/vendors/master"><Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" />Add Vendor</Button></Link>
        </div>
      </div>
      <VendorFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <VendorDashboardCharts vendors={vendors} performance={performance} />
          <Card><CardHeader><CardTitle>Vendor Register</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead>
              <TableHead>Material</TableHead><TableHead>Approval</TableHead><TableHead>Risk</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {vendors.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No vendors found</TableCell></TableRow>
                : vendors.slice(0, 15).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-sm">{v.vendor_code}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{v.vendor_name}</TableCell>
                    <TableCell className="text-xs">{v.vendor_type}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">{v.material_service_supplied}</TableCell>
                    <TableCell><ApprovalBadge status={v.approval_status} /></TableCell>
                    <TableCell><RiskBadge level={v.risk_category} /></TableCell>
                    <TableCell><Link href={`/qms/vendors/${v.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
