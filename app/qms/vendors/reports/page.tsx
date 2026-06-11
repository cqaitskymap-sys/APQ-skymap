'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VendorDashboardCharts } from '@/components/vendor-mgmt/vendor-dashboard-charts';
import { useVendors } from '@/hooks/use-vendor-mgmt';
import { exportVendorsCsv, exportAvlCsv } from '@/lib/vendor-mgmt-service';
import { printPage } from '@/lib/export-utils';

const REPORTS = [
  'Vendor Master Register', 'Approved Vendor List', 'Vendor Qualification Report',
  'Supplier Audit Report', 'Technical Agreement Register', 'Vendor Performance Report', 'High Risk Vendor Report',
];

export default function VendorReportsPage() {
  const { vendors, avl, performance, metrics, loading } = useVendors({});

  const highRisk = vendors.filter((v) => ['High', 'Critical'].includes(v.risk_category));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendor Reports</h1>
          <p className="text-muted-foreground text-sm">Registers, analytics, and compliance exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportVendorsCsv(vendors)}><Download className="h-4 w-4 mr-1" />Vendor CSV</Button>
          <Button variant="outline" onClick={() => exportAvlCsv(avl)}><Download className="h-4 w-4 mr-1" />AVL CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({
                'Total Vendors': metrics.total, 'Approved': metrics.approved,
                'High Risk': metrics.highRisk, 'Expired': metrics.expired,
              }).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
              ))}
            </div>
          )}
          <VendorDashboardCharts vendors={vendors} performance={performance} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map((title) => (
              <Card key={title}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Export CSV for bulk data or generate PDF from individual vendor detail page.</p>
                </CardContent></Card>
            ))}
          </div>
          {highRisk.length > 0 && (
            <Card><CardHeader><CardTitle className="text-sm">High Risk Vendors ({highRisk.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Code</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Risk</th><th className="p-2 text-left">Status</th></tr></thead>
                  <tbody>{highRisk.map((v) => (
                    <tr key={v.id} className="border-b"><td className="p-2 font-mono">{v.vendor_code}</td>
                      <td className="p-2">{v.vendor_name}</td><td className="p-2">{v.risk_category}</td><td className="p-2">{v.approval_status}</td></tr>
                  ))}</tbody></table>
              </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
