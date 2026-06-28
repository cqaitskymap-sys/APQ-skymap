import { NextResponse } from 'next/server';
import { runScheduledEffectiveDateActivation } from '@/lib/effective-date-service';

/**
 * Cron endpoint for scheduled document activation.
 * Set EFFECTIVE_DATE_CRON_SECRET in env and pass as Authorization: Bearer <secret>
 * Configure in Cloud Scheduler, Vercel Cron, or Firebase scheduled functions caller.
 */
export async function POST(request: Request) {
  const secret = process.env.EFFECTIVE_DATE_CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runScheduledEffectiveDateActivation();
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Activation failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
