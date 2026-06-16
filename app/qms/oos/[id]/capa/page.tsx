'use client';

import { useParams } from 'next/navigation';
import { OosCapaPage } from '@/components/oos/capa/oos-capa-page';

export default function Page() {
  const params = useParams();
  return <OosCapaPage oosId={params.id as string} />;
}
