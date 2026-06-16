'use client';

import { useParams } from 'next/navigation';
import { DeviationInvestigationPageShell } from '@/components/deviations/investigation/deviation-investigation-page';

export default function Page() {
  const params = useParams();
  const id = params.id as string;
  return <DeviationInvestigationPageShell deviationId={id} />;
}
