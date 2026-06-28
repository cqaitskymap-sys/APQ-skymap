'use client';

import type { TrainingCertificateRecord } from '@/lib/training-certificate-types';
import { CertificateStatusBadge } from './certificate-status-badge';
import { ExpiryIndicator, QRCodePlaceholder } from './expiry-indicator';

interface CertificatePreviewProps {
  cert: TrainingCertificateRecord;
}

export function CertificatePreview({ cert }: CertificatePreviewProps) {
  return (
    <div className="border-4 double border-blue-900 rounded-lg p-8 bg-gradient-to-b from-white to-blue-50/30 text-center max-w-lg mx-auto">
      <p className="text-xs uppercase tracking-widest text-blue-800 mb-2">Certificate of Training</p>
      <h2 className="text-xl font-serif font-bold text-blue-950 mb-1">GMP Training Certificate</h2>
      <p className="text-sm font-mono text-muted-foreground mb-6">{cert.certificate_number}</p>
      <p className="text-lg font-semibold">{cert.employee_name}</p>
      <p className="text-sm text-muted-foreground">{cert.department} · {cert.designation}</p>
      <p className="text-sm mt-4">has successfully completed</p>
      <p className="text-base font-medium mt-1">{cert.training_topic}</p>
      <p className="text-xs text-muted-foreground mt-2">{cert.training_type} · {cert.document_number}</p>
      <div className="flex items-center justify-center gap-6 mt-6">
        <QRCodePlaceholder data={cert.qr_code_data || cert.verification_code} size={72} />
        <div className="text-left text-xs space-y-1">
          <p>Issue: {cert.issue_date}</p>
          <ExpiryIndicator expiryDate={cert.expiry_date} />
          <p>Result: {cert.result}</p>
          <p className="font-mono text-[10px]">Verify: {cert.verification_code}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <CertificateStatusBadge status={cert.certificate_status} />
        <CertificateStatusBadge status={cert.approval_status} />
      </div>
      {cert.approved_by && (
        <p className="text-xs text-muted-foreground mt-4">Approved by {cert.approved_by} · {cert.approved_date?.slice(0, 10)}</p>
      )}
      <p className="text-[10px] text-muted-foreground mt-4">21 CFR Part 11 · EU GMP Annex 11 · ALCOA+</p>
    </div>
  );
}
