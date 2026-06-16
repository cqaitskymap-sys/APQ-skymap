'use client';

import { OOS_WIZARD_STEPS } from '@/lib/oos-create-records';
import { cn } from '@/lib/utils';

export function OosStepWizard({ step }: { step: number }) {
  const progress = Math.round((step / OOS_WIZARD_STEPS.length) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Step {step} of {OOS_WIZARD_STEPS.length}: {OOS_WIZARD_STEPS[step - 1]}
        </span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="hidden flex-wrap gap-1 lg:flex">
        {OOS_WIZARD_STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px]',
              i + 1 === step ? 'border-blue-600 bg-blue-600 text-white'
                : i + 1 < step ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500',
            )}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>
    </div>
  );
}
