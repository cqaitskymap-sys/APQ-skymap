import { NextResponse } from 'next/server';
import { runScheduledDocumentAuditJobs } from '@/lib/document-audit-trail-service';

export async function POST(request: Request) {
  const secret = process.env.DOCUMENT_AUDIT_CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const result = await runScheduledDocumentAuditJobs();
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Scheduler failed' }, { status: 500 });
  }
}

export async function GET(request: Request) { return POST(request); }
