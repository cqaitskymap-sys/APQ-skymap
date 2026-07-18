'use client';;
import { use } from "react";

import { RecallRegulatoryPage } from '@/components/recall/regulatory/recall-regulatory-page';

export default function Page(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <RecallRegulatoryPage recallId={params.id} />;
}
