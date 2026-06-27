'use client';

import { cn } from '@/lib/utils';
import { RISK_CREATE_WIZARD_STEPS } from '@/lib/risk-create-records';

export function RiskCreateWizard({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap gap-1 mb-6">
      {RISK_CREATE_WIZARD_STEPS.map((label, i) => (
        <div
          key={label}
          className={cn(
            'flex items-center text-xs px-2 py-1 rounded-md',
            i + 1 === step ? 'bg-blue-100 text-blue-800 font-medium' : i + 1 < step ? 'text-green-700' : 'text-muted-foreground',
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
