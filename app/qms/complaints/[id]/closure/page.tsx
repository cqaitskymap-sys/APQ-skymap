'use client';

import { useParams } from 'next/navigation';
import { ComplaintClosurePageShell } from '@/components/complaints/closure/complaint-closure-page';

export default function ComplaintClosureRoute() {
  const id = useParams().id as string;
  return <ComplaintClosurePageShell complaintId={id} />;
}
