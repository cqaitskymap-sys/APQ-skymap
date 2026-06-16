'use client';

import { WIZARD_STEPS } from '@/lib/pqr-create-records';
import { cn } from '@/lib/utils';

export function PqrWizard({ step }: { step: number }) {
  const progress = Math.round((step / WIZARD_STEPS.length) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          Step {step} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step - 1]}
        </span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="hidden lg:flex flex-wrap gap-1">
        {WIZARD_STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] border',
              i + 1 === step ? 'bg-blue-600 text-white border-blue-600' : i + 1 < step ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200',
            )}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>
    </div>
  );
}
