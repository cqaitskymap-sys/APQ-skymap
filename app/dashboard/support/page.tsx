import Link from 'next/link';
import { ExternalLink, LifeBuoy, LockKeyhole, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@pharmaqms.com';

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">Use the appropriate controlled channel for assistance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LifeBuoy className="h-4 w-4" />Application support</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            Include the module, record number, time, and a non-sensitive description. Do not email passwords or signature credentials.
            <Button asChild className="w-full">
              <a href={`mailto:${supportEmail}?subject=SkyMap%20QMS%20Support`}>
                Email support <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" />Security or data integrity</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            Report suspected unauthorized access, missing audit events, incorrect records, or signature concerns immediately.
            <Button asChild variant="destructive" className="w-full">
              <a href={`mailto:${supportEmail}?subject=URGENT%20SkyMap%20Security%20or%20Data%20Integrity`}>
                Escalate issue <LockKeyhole className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Button asChild variant="link" className="px-0"><Link href="/dashboard/help">Return to Help Center</Link></Button>
    </div>
  );
}
