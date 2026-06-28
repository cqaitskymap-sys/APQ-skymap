'use client';

import { cn } from '@/lib/utils';
import { historyStatusColor } from '@/lib/training-history-types';
import type { EmployeeExtendedProfile } from '@/lib/training-history-types';
import { User, Building2, Briefcase, Mail, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function HistoryStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', historyStatusColor(status))}>
      {status}
    </span>
  );
}

export function EmployeeProfileCard({ profile }: { profile: EmployeeExtendedProfile | null }) {
  if (!profile) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Select an employee to view training history
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <User className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{profile.employee_name}</CardTitle>
            <p className="text-xs font-mono text-muted-foreground">{profile.employee_number}</p>
            <span className="inline-flex mt-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
              {profile.employment_status}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span>{profile.department}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5 shrink-0" />
          <span>{profile.designation}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{profile.email || '—'}</span>
        </div>
        {profile.reporting_manager && (
          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Manager: {profile.reporting_manager}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
