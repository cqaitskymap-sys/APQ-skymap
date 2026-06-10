'use client';

import { useState } from 'react';
import { PenLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { signPqrApproval } from '@/lib/pqr-service';
import type { PqrApproval, ESignPayload } from '@/lib/pqr-types';
import { useAuth } from '@/contexts/auth-context';

interface ESignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pqrId: string;
  approval: PqrApproval;
  onSigned: () => void;
}

export function ESignatureDialog({ open, onOpenChange, pqrId, approval, onSigned }: ESignatureDialogProps) {
  const { user, profile } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [meaning, setMeaning] = useState<ESignPayload['meaning']>(
    approval.approval_type === 'approved' ? 'Approved By' : approval.approval_type === 'prepared' ? 'Prepared By' : 'Reviewed By'
  );
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    if (!password || password.length < 4) {
      toast.error('Enter your password to confirm e-signature');
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason for signature is required (21 CFR Part 11)');
      return;
    }
    setSigning(true);
    try {
      await signPqrApproval(pqrId, {
        approvalId: approval.id!,
        password,
        reason,
        meaning,
      }, {
        id: user?.uid,
        name: profile?.full_name || profile?.email || approval.name,
        role: profile?.role,
        email: profile?.email,
      });
      toast.success('Electronic signature recorded successfully');
      onOpenChange(false);
      setPassword('');
      setReason('');
      onSigned();
    } catch (e) {
      toast.error((e as Error).message || 'E-signature failed');
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-blue-600" />
            Electronic Signature
          </DialogTitle>
          <DialogDescription>
            21 CFR Part 11 compliant e-signature for {approval.designation}. This action is legally binding.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Signer:</span> {profile?.full_name || 'Current User'}</p>
            <p><span className="text-muted-foreground">Role:</span> {profile?.role?.replace(/_/g, ' ')}</p>
            <p><span className="text-muted-foreground">Designation:</span> {approval.designation}</p>
          </div>
          <div className="space-y-2">
            <Label>Signature Meaning *</Label>
            <Select value={meaning} onValueChange={(v) => setMeaning(v as ESignPayload['meaning'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Prepared By', 'Reviewed By', 'Approved By', 'Rejected By', 'Verified By'].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason for Signature *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Document review completed..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Password Confirmation *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Re-enter your password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSign} disabled={signing} className="bg-blue-600 hover:bg-blue-700">
            {signing ? 'Signing...' : 'Apply E-Signature'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
