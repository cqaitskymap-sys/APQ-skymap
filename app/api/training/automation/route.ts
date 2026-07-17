import { NextResponse } from 'next/server';

/**
 * POST /api/training/automation
 * Scheduled training automation — refresher, expiry reminders, linkage sync.
 * Called by Firebase Cloud Function or Cloud Scheduler.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.TRAINING_AUTOMATION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Training automation API is not configured' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: false,
    error: 'Manual automation is disabled. The idempotent job runs in Firebase Cloud Functions.',
    timestamp: new Date().toISOString(),
  }, { status: 409 });
}
