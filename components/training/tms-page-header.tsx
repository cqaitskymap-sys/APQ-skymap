'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { ReactNode } from 'react';

interface TmsPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  trail?: { label: string; href?: string }[];
}

const DEFAULT_TRAIL = [
  { label: 'QMS', href: '/qms' },
  { label: 'Training Management', href: '/qms/training' },
];

export function TmsPageHeader({ title, description, actions, trail }: TmsPageHeaderProps) {
  const crumbs = [...DEFAULT_TRAIL, ...(trail ?? [{ label: title }])];

  return (
    <div className="mb-6 space-y-4">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard" className="flex items-center gap-1 hover:text-blue-600">
          <Home className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
            {c.href ? (
              <Link href={c.href} className="hover:text-blue-600">{c.label}</Link>
            ) : (
              <span className="font-medium text-slate-900 dark:text-slate-100">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
