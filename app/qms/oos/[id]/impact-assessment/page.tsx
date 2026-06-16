'use client';

import { useParams } from 'next/navigation';
import { OosImpactPage } from '@/components/oos/impact-assessment/oos-impact-page';

export default function Page() {
  const params = useParams();
  return <OosImpactPage oosId={params.id as string} />;
}
