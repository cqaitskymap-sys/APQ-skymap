'use client';

import { useParams } from 'next/navigation';
import { DeviationCapaPageShell } from '@/components/deviations/capa-link/deviation-capa-page';

export default function Page() {
  const id = useParams().id as string;
  return <DeviationCapaPageShell deviationId={id} />;
}
