'use client';

import { useParams } from 'next/navigation';
import { OosPhase1Page } from '@/components/oos/phase1/oos-phase1-page';

export default function Page() {
  const params = useParams();
  return <OosPhase1Page oosId={params.id as string} />;
}
