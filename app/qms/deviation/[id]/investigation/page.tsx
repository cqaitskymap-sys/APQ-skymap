'use client';

import { useParams } from 'next/navigation';
import { DeviationDetailView } from '@/components/deviations/deviation-detail-view';

export default function DeviationInvestigationPage() {
  const id = useParams().id as string;
  return <DeviationDetailView id={id} defaultTab="investigation" />;
}
