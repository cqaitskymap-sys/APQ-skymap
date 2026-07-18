'use client';;
import { use } from "react";

import { RecallClosurePage } from '@/components/recall/closure/recall-closure-page';

export default function Page(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <RecallClosurePage recallId={params.id} />;
}
