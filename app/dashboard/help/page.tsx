import Link from 'next/link';
import { BookOpen, Search, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Guidance for controlled QMS work, records, approvals, and account access.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" />Find a module</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            Use global search to locate workflows available to your role.
            <Button asChild variant="outline" className="w-full"><Link href="/dashboard/search">Open search</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Controlled records</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Follow the assigned workflow, provide a reason for regulated actions, and never share credentials or signatures.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Access help</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            Contact support for access, lockout, data-integrity, or suspected security issues.
            <Button asChild variant="outline" className="w-full"><Link href="/dashboard/support">Contact support</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
