'use client';

import { useParams } from 'next/navigation';
import { OosDetailView } from '@/components/oos/oos-detail-view';

export default function OosPhase1Page() {
  return <OosDetailView id={useParams().id as string} defaultTab="phase1" />;
}
