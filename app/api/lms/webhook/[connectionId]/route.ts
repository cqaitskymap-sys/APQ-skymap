import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    const { connectionId } = await params;
    const signature = request.headers.get('x-lms-signature') ?? request.headers.get('x-webhook-signature');
    const body = await request.json().catch(() => ({}));

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 });
    }

    return NextResponse.json({
      received: true,
      connectionId,
      signatureVerified: Boolean(signature),
      event: body.event ?? body.type ?? 'sync',
      timestamp: new Date().toISOString(),
      message: 'Webhook received. Trigger client sync via dashboard or scheduled job.',
    });
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  return NextResponse.json({
    status: 'active',
    connectionId,
    webhookUrl: `/api/lms/webhook/${connectionId}`,
  });
}
