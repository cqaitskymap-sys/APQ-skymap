'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Diamond } from 'lucide-react';
import type { WorkflowDefinition, WorkflowStep } from '@/lib/enterprise-tms/workflows';

interface WorkflowDiagramProps {
  workflow: WorkflowDefinition;
  activeStepId?: string;
  completedStepIds?: string[];
  compact?: boolean;
  className?: string;
}

function StepNode({
  step, active, completed, compact,
}: { step: WorkflowStep; active?: boolean; completed?: boolean; compact?: boolean }) {
  const isDecision = step.decision;

  if (isDecision) {
    return (
      <div className={cn(
        'flex flex-col items-center shrink-0',
        step.dashed && 'opacity-70',
      )}>
        <div className={cn(
          'rotate-45 border-2 w-16 h-16 flex items-center justify-center',
          active ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40' :
          completed ? 'border-green-600 bg-green-50 dark:bg-green-950/40' :
          'border-slate-300 bg-white dark:bg-slate-900',
          step.dashed && 'border-dashed',
        )}>
          <Diamond className={cn(
            'h-4 w-4 -rotate-45',
            active ? 'text-blue-600' : completed ? 'text-green-600' : 'text-slate-400',
          )} />
        </div>
        {!compact && (
          <p className={cn(
            'mt-2 text-[10px] text-center max-w-[90px] leading-tight font-medium',
            active ? 'text-blue-700' : 'text-muted-foreground',
          )}>
            {step.label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center shrink-0 max-w-[120px]', step.dashed && 'opacity-70')}>
      <div className={cn(
        'rounded-lg border-2 px-3 py-2 text-center min-w-[100px]',
        step.dashed ? 'border-dashed' : 'border-solid',
        active ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 shadow-sm' :
        completed ? 'border-green-600 bg-green-50 dark:bg-green-950/40' :
        'border-slate-200 bg-white dark:bg-slate-900',
      )}>
        <p className={cn(
          'text-[10px] font-semibold leading-tight',
          active ? 'text-blue-700 dark:text-blue-300' :
          completed ? 'text-green-700 dark:text-green-300' :
          'text-slate-700 dark:text-slate-300',
        )}>
          {step.label}
        </p>
      </div>
      {step.actor && !compact && (
        <Badge variant="outline" className="mt-1 text-[9px] px-1 py-0 h-4">
          {step.actor}
        </Badge>
      )}
      {step.optional && !compact && (
        <span className="text-[9px] text-muted-foreground mt-0.5">Optional</span>
      )}
    </div>
  );
}

export function WorkflowDiagram({
  workflow, activeStepId, completedStepIds = [], compact, className,
}: WorkflowDiagramProps) {
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 p-4 overflow-x-auto', className)}>
      <div className="mb-3">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">{workflow.title}</p>
        {!compact && <p className="text-[11px] text-muted-foreground mt-0.5">{workflow.description}</p>}
      </div>
      <div className="flex items-start gap-1 min-w-max pb-1">
        {workflow.steps.map((step, i) => (
          <div key={step.id} className="flex items-start gap-1">
            <StepNode
              step={step}
              active={step.id === activeStepId}
              completed={completedStepIds.includes(step.id)}
              compact={compact}
            />
            {i < workflow.steps.length - 1 && (
              <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 mt-6 mx-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vertical role-action diagram (Coordinator → steps → outcome) */
export function RoleActionFlow({
  role, steps, outcome, className,
}: {
  role: string;
  steps: string[];
  outcome: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 overflow-x-auto py-2', className)}>
      <div className="shrink-0 rounded-lg border-2 border-blue-700 bg-blue-700 text-white px-3 py-4 text-center min-w-[100px]">
        <p className="text-[10px] font-bold uppercase">{role}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-blue-500 shrink-0" />
      <div className="shrink-0 rounded-lg border-2 border-blue-200 bg-white dark:bg-slate-900 px-4 py-3 min-w-[200px]">
        <ol className="text-xs space-y-1 list-decimal list-inside text-slate-700 dark:text-slate-300">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>
      <ArrowRight className="h-5 w-5 text-blue-500 shrink-0" />
      <div className="shrink-0 rounded-lg border-2 border-green-600 bg-green-50 dark:bg-green-950/30 px-4 py-3 min-w-[140px] text-center">
        <p className="text-xs font-semibold text-green-700 dark:text-green-300">{outcome}</p>
      </div>
    </div>
  );
}
