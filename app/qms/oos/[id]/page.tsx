'use client';

import { useParams } from 'next/navigation';
import { OosDetailView } from '@/components/oos/oos-detail-view';

export default function OosDetailPage() {
  return <OosDetailView id={useParams().id as string} defaultTab="overview" />;
}
