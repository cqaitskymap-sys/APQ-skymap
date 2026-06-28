import { NextResponse } from 'next/server';
import { runScheduledTrainingLinkageJobs } from '@/lib/document-training-linkage-service';

/** Cron: POST /api/dms/training-linkage/schedule — assign, remind, escalate overdue training */
export async function POST(request: Request) {
  const secret = process.env.TRAINING_LINKAGE_CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runScheduledTrainingLinkageJobs();
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
