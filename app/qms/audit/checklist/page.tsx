'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuditStatusBadge } from '@/components/audit-mgmt/audit-sub-nav';
import { useAudits } from '@/hooks/use-audit-mgmt';

export default function AuditChecklistPage() {
  const { audits, loading } = useAudits({});
  const active = audits.filter((a) => ['in_progress', 'scheduled', 'planned'].includes(a.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Checklist</h1>
        <p className="text-muted-foreground text-sm">Manage checklists for active audits</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Active Audits ({active.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
            <TableHead>Department</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader><TableBody>
            {active.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No active audits</TableCell></TableRow>
              : active.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.audit_number}</TableCell>
                  <TableCell>{a.audit_title}</TableCell>
                  <TableCell className="text-xs">{a.audit_type}</TableCell>
                  <TableCell>{a.department}</TableCell>
                  <TableCell>{a.audit_date}</TableCell>
                  <TableCell><AuditStatusBadge status={a.status} /></TableCell>
                  <TableCell><Link href={`/qms/audit/${a.id}/checklist`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
