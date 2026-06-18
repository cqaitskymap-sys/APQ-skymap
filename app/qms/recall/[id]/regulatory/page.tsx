'use client';

import { RecallRegulatoryPage } from '@/components/recall/regulatory/recall-regulatory-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RecallRegulatoryPage recallId={params.id} />;
}
