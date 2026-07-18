import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const runtime = 'nodejs';

function isPrivateAddress(address: string): boolean {
  if (address === '::1' || address === '0.0.0.0') return true;
  if (address.startsWith('10.') || address.startsWith('127.') || address.startsWith('169.254.')) return true;
  if (address.startsWith('192.168.')) return true;
  const secondOctet = Number(address.split('.')[1]);
  if (address.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31) return true;
  const normalized = address.toLowerCase();
  return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function validateTarget(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS LMS endpoints are allowed');
  if (url.username || url.password) throw new Error('Credentials must not be embedded in the URL');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
    throw new Error('Private LMS endpoints are not allowed');
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private LMS endpoints are not allowed');
  }
  return url;
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const secret = process.env.LMS_CONNECTION_TEST_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, message: 'Connection testing is not configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json() as { base_url?: string; authentication_type?: string };

    if (!body.base_url) {
      return NextResponse.json({ success: false, message: 'base_url is required for connection test' }, { status: 400 });
    }

    let reachable = false;
    let statusCode = 0;
    try {
      const target = await validateTarget(body.base_url);
      const res = await fetch(target, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
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
