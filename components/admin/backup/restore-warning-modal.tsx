'use client';

import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RestoreWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  backupNumber?: string;
  restoreType?: string;
}

export function RestoreWarningModal({
  open, onOpenChange, onConfirm, backupNumber, restoreType,
}: RestoreWarningModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Critical: Restore Operation
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <p>
              You are about to restore data from backup <strong>{backupNumber}</strong>
              ({restoreType}). This operation may overwrite existing records.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>A pre-restore backup will be created automatically.</li>
              <li>Audit trail records cannot be deleted or overwritten.</li>
              <li>Super Admin approval and e-signature are required.</li>
              <li>This action is logged in the immutable audit trail.</li>
            </ul>
            <p className="text-red-600 font-medium text-sm">
              Only proceed if you are authorized and understand the impact on GMP data integrity.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            I Understand — Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
