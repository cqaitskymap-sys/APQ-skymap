'use client';

import { useParams } from 'next/navigation';
import { OosClosurePageShell } from '@/components/oos/closure/oos-closure-page';

export default function Page() {
  const id = useParams().id as string;
  return <OosClosurePageShell oosId={id} />;
}
