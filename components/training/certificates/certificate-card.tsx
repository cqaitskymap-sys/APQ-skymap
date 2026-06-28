'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TrainingCertificateRecord } from '@/lib/training-certificate-types';
import { CertificateStatusBadge } from './certificate-status-badge';
import { ExpiryIndicator } from './expiry-indicator';

interface CertificateCardProps {
  cert: TrainingCertificateRecord;
  onView?: () => void;
  onRenew?: () => void;
  selected?: boolean;
  showActions?: boolean;
}

export function CertificateCard({ cert, onView, onRenew, selected, showActions }: CertificateCardProps) {
  return (
    <Card className={cn('transition-colors hover:border-blue-300', selected && 'border-blue-500 bg-blue-50/30')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-mono">{cert.certificate_number}</CardTitle>
          <CertificateStatusBadge status={cert.certificate_status} />
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-1.5">
        <p className="font-medium text-sm">{cert.employee_name}</p>
        <p className="text-muted-foreground">{cert.department} · {cert.training_topic}</p>
        <ExpiryIndicator expiryDate={cert.expiry_date} />
        <p className="text-muted-foreground">Issued: {cert.issue_date}</p>
        {showActions && (
          <div className="flex gap-1 pt-2">
            {onView && <Button size="sm" variant="ghost" onClick={onView}>View</Button>}
            {onRenew && <Button size="sm" variant="outline" onClick={onRenew}>Renew</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
