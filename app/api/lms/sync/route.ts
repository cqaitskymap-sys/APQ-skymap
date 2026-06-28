import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, triggeredBy } = body as { connectionId?: string; triggeredBy?: string };

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
    }

    return NextResponse.json({
      accepted: true,
      connectionId,
      message: 'Sync request accepted. Client-side sync engine will process the job.',
      triggeredBy: triggeredBy ?? 'api',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'lms-sync' });
}
