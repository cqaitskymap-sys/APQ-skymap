import { NextResponse } from 'next/server';
import { runScheduledPeriodicReviewJobs } from '@/lib/periodic-review-service';

/**
 * Cron endpoint for periodic review scheduler (task generation, reminders, escalation).
 * Set PERIODIC_REVIEW_CRON_SECRET in env and pass as Authorization: Bearer <secret>
 */
export async function POST(request: Request) {
  const secret = process.env.PERIODIC_REVIEW_CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runScheduledPeriodicReviewJobs();
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Scheduler failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
