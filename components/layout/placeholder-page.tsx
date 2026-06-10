'use client';

import Link from 'next/link';
import { Construction } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  backLabel?: string;
}

export function PlaceholderPage({
  title,
  description = 'This module is being prepared. Core navigation and routing are ready.',
  breadcrumbs = [],
  backHref = '/dashboard',
  backLabel = 'Back to Dashboard',
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      {breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {i === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href || '/dashboard'}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      <Card className="max-w-xl border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Construction className="h-5 w-5 text-amber-500" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page route is configured and accessible. Module implementation will connect to Firestore master data and workflows.
          </p>
          {backHref && (
            <Button asChild variant="outline">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
