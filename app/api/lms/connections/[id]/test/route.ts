import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json() as { base_url?: string; authentication_type?: string };

    if (!body.base_url) {
      return NextResponse.json({ success: false, message: 'base_url is required for connection test' }, { status: 400 });
    }

    let reachable = false;
    let statusCode = 0;
    try {
      const res = await fetch(body.base_url.replace(/\/$/, ''), {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      reachable = res.ok || res.status === 401 || res.status === 403;
      statusCode = res.status;
    } catch (e) {
      return NextResponse.json({
        success: false,
        connectionId: id,
        message: e instanceof Error ? e.message : 'Connection unreachable',
      });
    }

    return NextResponse.json({
      success: reachable,
      connectionId: id,
      message: reachable
        ? `Connection reachable (HTTP ${statusCode}). Auth type: ${body.authentication_type ?? 'unknown'}`
        : `Connection failed: HTTP ${statusCode}`,
      statusCode,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Connection test failed' }, { status: 500 });
  }
}
