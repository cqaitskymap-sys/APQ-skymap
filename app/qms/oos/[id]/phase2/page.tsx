'use client';

import { useParams } from 'next/navigation';
import { OosPhase2Page } from '@/components/oos/phase2/oos-phase2-page';

export default function Page() {
  const params = useParams();
  return <OosPhase2Page oosId={params.id as string} />;
}
