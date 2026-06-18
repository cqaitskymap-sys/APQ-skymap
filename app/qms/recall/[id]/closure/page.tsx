'use client';

import { RecallClosurePage } from '@/components/recall/closure/recall-closure-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RecallClosurePage recallId={params.id} />;
}
