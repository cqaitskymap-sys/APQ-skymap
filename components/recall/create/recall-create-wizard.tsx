'use client';

import { cn } from '@/lib/utils';
import { RECALL_WIZARD_STEPS } from '@/lib/recall-create-records';

export function RecallCreateWizard({ step }: { step: number }) {
  return (
    <div className="mb-6 flex flex-wrap gap-1">
      {RECALL_WIZARD_STEPS.map((label, i) => (
        <div
          key={label}
          className={cn(
            'flex items-center rounded-md px-2 py-1 text-xs',
            i + 1 === step ? 'bg-blue-100 font-medium text-blue-800' : i + 1 < step ? 'text-green-700' : 'text-muted-foreground',
          )}
        >
          {i > 0 && <span className="mx-1 text-muted-foreground">›</span>}
          <span className="hidden sm:inline">{i + 1}. {label}</span>
          <span className="sm:hidden">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
