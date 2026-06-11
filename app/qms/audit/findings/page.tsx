'use client';

import Link from 'next/link';
import { Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuditStatusBadge, FindingTypeBadge, RiskBadge } from '@/components/audit-mgmt/audit-sub-nav';
import { useAudits } from '@/hooks/use-audit-mgmt';
import { exportFindingsCsv } from '@/lib/audit-mgmt-service';

export default function AuditFindingsPage() {
  const { findings, loading } = useAudits({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Findings</h1>
          <p className="text-muted-foreground text-sm">All audit findings across the organization</p>
        </div>
        <Button variant="outline" onClick={() => exportFindingsCsv(findings)}><Download className="h-4 w-4 mr-1" />Export</Button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Finding #</TableHead><TableHead>Audit</TableHead><TableHead>Type</TableHead>
            <TableHead>Category</TableHead><TableHead>RPN</TableHead><TableHead>CAPA</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader><TableBody>
            {findings.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No findings</TableCell></TableRow>
              : findings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-sm">{f.finding_number}</TableCell>
                  <TableCell>{f.audit_number}</TableCell>
                  <TableCell><FindingTypeBadge type={f.finding_type} /></TableCell>
                  <TableCell>{f.finding_category}</TableCell>
                  <TableCell><RiskBadge level={f.risk_level} /> ({f.rpn})</TableCell>
                  <TableCell>{f.linked_capa_number || '—'}</TableCell>
                  <TableCell><AuditStatusBadge status={f.finding_status} /></TableCell>
                  <TableCell><Link href={`/qms/audit/${f.audit_id}/findings`}><Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
