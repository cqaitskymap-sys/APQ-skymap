'use client';

import { useParams } from 'next/navigation';
import { DeviationClosurePageShell } from '@/components/deviations/closure/deviation-closure-page';

export default function Page() {
  const id = useParams().id as string;
  return <DeviationClosurePageShell deviationId={id} />;
}
