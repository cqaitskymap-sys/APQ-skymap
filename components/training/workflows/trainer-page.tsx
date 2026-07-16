'use client';

import { useState } from 'react';
import { Unlock, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { RoleActionFlow } from '@/components/training/workflow/workflow-diagram';
import { TRAINER_ACTIONS_WORKFLOW } from '@/lib/enterprise-tms/workflows';

export function TrainerPage() {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [justification, setJustification] = useState('');

  const handleUnlock = () => {
    if (!justification.trim()) return toast.error('Justification required');
    toast.success('Exam unlocked for trainee');
    setUnlockOpen(false);
    setJustification('');
  };

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Trainer"
        description="Unlock locked trainee, answer questions, approve/reject trainee suggestions"
        trail={[{ label: 'Session & Assessment' }, { label: 'Trainer' }]}
      />

      <RoleActionFlow
        role="Trainer"
        steps={TRAINER_ACTIONS_WORKFLOW.steps.map((s) => s.label)}
        outcome="Trainee Supported"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Unlock Locked Trainee</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">After exam fail (locked), unlock with justification (RS-LMS-GEN-005)</p>
            <Button size="sm" className="w-full" onClick={() => setUnlockOpen(true)}>
              <Unlock className="h-4 w-4 mr-2" /> Unlock Exam
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Answer Trainee Questions</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Respond to trainee queries during training</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => toast.info('Q&A module')}>
              <MessageSquare className="h-4 w-4 mr-2" /> Open Q&A
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trainee Suggestions</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success('Suggestion approved')}>
              <ThumbsUp className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => toast.info('Suggestion rejected')}>
              <ThumbsDown className="h-4 w-4 mr-1" /> Reject
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unlock Locked Trainee</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Trainee</Label>
              <Input placeholder="Select locked trainee" />
            </div>
            <div>
              <Label>Justification *</Label>
              <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>Cancel</Button>
            <Button onClick={handleUnlock}><Unlock className="h-4 w-4 mr-2" /> Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
