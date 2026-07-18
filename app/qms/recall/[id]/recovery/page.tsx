'use client';;
import { use } from "react";

import { RecallRecoveryPage } from '@/components/recall/recovery/recall-recovery-page';

export default function Page(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <RecallRecoveryPage recallId={params.id} />;
}
