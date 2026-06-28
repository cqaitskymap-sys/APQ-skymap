'use client';

import { useState } from 'react';
import { Search, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyCertificate } from '@/lib/training-certificate-service';
import type { CertificateActor, TrainingCertificateRecord } from '@/lib/training-certificate-types';
import { CertificatePreview } from './certificate-preview';

interface VerificationPanelProps {
  actor?: CertificateActor;
  onVerified?: () => void;
}

export function VerificationPanel({ actor, onVerified }: VerificationPanelProps) {
  const [code, setCode] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [result, setResult] = useState<{ valid: boolean; message: string; cert: TrainingCertificateRecord | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await verifyCertificate(code, certNumber || undefined, actor);
      setResult({ valid: res.valid, message: res.message, cert: res.certificate });
      onVerified?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Certificate Verification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Verification Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VER-…" />
        </div>
        <div>
          <Label>Certificate Number (optional)</Label>
          <Input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="TCERT-…" />
        </div>
        <Button onClick={handleVerify} disabled={!code || loading}>Verify Certificate</Button>
        {result && (
          <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${result.valid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.valid ? <CheckCircle className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.cert && <p className="text-xs mt-1">{result.cert.employee_name} — {result.cert.training_topic}</p>}
            </div>
          </div>
        )}
        {result?.cert && result.valid && <CertificatePreview cert={result.cert} />}
      </CardContent>
    </Card>
  );
}
