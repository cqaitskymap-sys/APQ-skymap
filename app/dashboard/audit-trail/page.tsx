'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Download, Filter } from 'lucide-react';
import { useState } from 'react';

const mockAuditLogs = [
  { id: '1', user: 'Dr. Sarah', action: 'CREATE', module: 'Deviations', record: 'DEV-2024-015', timestamp: '2024-01-24 10:30:45', ip: '192.168.1.50' },
  { id: '2', user: 'Dr. John', action: 'UPDATE', module: 'Batches', record: 'BTH-2024-045', timestamp: '2024-01-24 09:15:22', ip: '192.168.1.51' },
  { id: '3', user: 'Admin User', action: 'APPROVE', module: 'CAPA', record: 'CAPA-2024-015', timestamp: '2024-01-24 08:45:10', ip: '192.168.1.100' },
  { id: '4', user: 'Dr. Emma', action: 'DELETE', module: 'OOS', record: 'OOS-2024-003', timestamp: '2024-01-23 16:20:35', ip: '192.168.1.52' },
];

export default function AuditTrailPage() {
  const [search, setSearch] = useState('');

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'APPROVE': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground">21 CFR Part 11 compliant activity log</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Records</p><p className="text-3xl font-bold">2,847</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Today</p><p className="text-3xl font-bold">48</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">This Month</p><p className="text-3xl font-bold">1,234</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Data Integrity</p><p className="text-3xl font-bold">100%</p></CardContent></Card>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search user, module, record..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Timestamp</th>
                  <th className="px-6 py-3 text-left font-semibold">User</th>
                  <th className="px-6 py-3 text-left font-semibold">Action</th>
                  <th className="px-6 py-3 text-left font-semibold">Module</th>
                  <th className="px-6 py-3 text-left font-semibold">Record</th>
                  <th className="px-6 py-3 text-left font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {mockAuditLogs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/50">
                    <td className="px-6 py-3 font-mono text-xs">{log.timestamp}</td>
                    <td className="px-6 py-3">{log.user}</td>
                    <td className="px-6 py-3"><Badge className={getActionColor(log.action)} variant="outline">{log.action}</Badge></td>
                    <td className="px-6 py-3">{log.module}</td>
                    <td className="px-6 py-3 font-mono">{log.record}</td>
                    <td className="px-6 py-3 font-mono text-xs">{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
