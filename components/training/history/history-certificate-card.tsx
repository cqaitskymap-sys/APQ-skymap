'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CertificateHistoryEntry } from '@/lib/training-history-types';
import { Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HistoryCertificateCard({ cert }: { cert: CertificateHistoryEntry }) {
  const isExpired = cert.status === 'Expired';
  return (
    <Card className={cn('border-slate-200', isExpired && 'border-red-300')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold line-clamp-2">{cert.training_topic}</CardTitle>
          <Shield className={cn('h-4 w-4 shrink-0', isExpired ? 'text-red-500' : 'text-green-600')} />
        </div>
        <p className="text-xs font-mono text-muted-foreground">{cert.certificate_number}</p>
      </CardHeader>
      <CardContent className="text-xs space-y-1 text-muted-foreground">
        <p>Issued: {cert.issue_date}</p>
        <p className={cn(isExpired && 'text-red-600 font-medium')}>Expires: {cert.expiry_date}</p>
        {isExpired && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="h-3 w-3" /> Certificate expired
          </div>
        )}
      </CardContent>
    </Card>
  );
}
