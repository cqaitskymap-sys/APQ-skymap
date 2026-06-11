'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAudits } from '@/hooks/use-audit-mgmt';
import { listCapaLinks } from '@/lib/audit-mgmt-service';
import { useEffect, useState } from 'react';
import type { AuditCapaLink } from '@/lib/audit-mgmt-types';

export default function AuditCapaPage() {
  const { loading } = useAudits({});
  const [links, setLinks] = useState<AuditCapaLink[]>([]);

  useEffect(() => { listCapaLinks().then(setLinks); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit CAPA</h1>
        <p className="text-muted-foreground text-sm">CAPA records linked from audit findings</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>CAPA Links ({links.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>CAPA Number</TableHead><TableHead>Linked By</TableHead><TableHead>Linked Date</TableHead><TableHead></TableHead>
          </TableRow></TableHeader><TableBody>
            {links.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No CAPA links</TableCell></TableRow>
              : links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-sm">{l.capa_number}</TableCell>
                  <TableCell>{l.linked_by_name}</TableCell>
                  <TableCell>{new Date(l.linked_at).toLocaleDateString()}</TableCell>
                  <TableCell className="flex gap-1">
                    <Link href={`/qms/capa/${l.capa_id}`}><Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button></Link>
                    <Link href={`/qms/audit/${l.audit_id}/capa`}><Button variant="outline" size="sm">Audit</Button></Link>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
