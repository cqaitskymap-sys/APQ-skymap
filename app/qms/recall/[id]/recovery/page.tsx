'use client';

import { RecallRecoveryPage } from '@/components/recall/recovery/recall-recovery-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RecallRecoveryPage recallId={params.id} />;
}
