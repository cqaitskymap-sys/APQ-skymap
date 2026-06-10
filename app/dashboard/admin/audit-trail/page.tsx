'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Shield } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminDataTable, ColumnDef } from '@/components/admin/admin-data-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs } from '@/lib/admin/admin-service';
import { ADMIN_MODULES } from '@/lib/admin/constants';
import type { AdminAuditLog } from '@/lib/admin/schemas';

export default function AdminAuditTrailPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ module: '', action: '', recordId: '', startDate: '', endDate: '' });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const data = await getAuditLogs({
      module: filters.module || undefined,
      action: filters.action || undefined,
      recordId: filters.recordId || undefined,
    });
    let filtered = data;
    if (filters.startDate) filtered = filtered.filter((l) => l.dateTime >= filters.startDate);
    if (filters.endDate) filtered = filtered.filter((l) => l.dateTime <= filters.endDate + 'T23:59:59');
    setLogs(filtered);
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const columns: ColumnDef<AdminAuditLog>[] = [
    { key: 'dateTime', header: 'Date Time', render: (r) => new Date(r.dateTime).toLocaleString() },
    { key: 'userName', header: 'User' },
    { key: 'module', header: 'Module' },
    { key: 'recordId', header: 'Record ID', className: 'font-mono text-xs' },
    { key: 'action', header: 'Action', render: (r) => (
      <Badge variant="outline" className={
        r.action === 'DELETE' ? 'text-red-600' : r.action === 'CREATE' ? 'text-green-600' : 'text-blue-600'
      }>{r.action}</Badge>
    )},
    { key: 'reason', header: 'Reason' },
    { key: 'ipAddress', header: 'IP' },
    { key: 'status', header: 'Status' },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Audit Trail"
        description="Immutable system audit log — 21 CFR Part 11 compliant. Records cannot be edited or deleted."
      />

      <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Audit trail records are read-only and permanently retained for regulatory compliance.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 p-4 border rounded-lg bg-white dark:bg-slate-900">
        <div className="space-y-1">
          <Label className="text-xs">Module</Label>
          <Select value={filters.module} onValueChange={(v) => setFilters({ ...filters, module: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {ADMIN_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE', 'REJECT'].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Record ID</Label>
          <Input value={filters.recordId} onChange={(e) => setFilters({ ...filters, recordId: e.target.value })} placeholder="Filter by ID" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        </div>
        <div className="col-span-full">
          <Button onClick={loadLogs} className="bg-blue-600"><Search className="h-4 w-4 mr-2" />Apply Filters</Button>
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={logs}
        loading={loading}
        searchKeys={['userName', 'module', 'action', 'recordId']}
        emptyMessage="No audit records found"
      />
    </div>
  );
}
