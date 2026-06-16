'use client';

import { useParams } from 'next/navigation';
import { DeviationApprovalPageShell } from '@/components/deviations/approval/deviation-approval-page';

export default function Page() {
  const id = useParams().id as string;
  return <DeviationApprovalPageShell deviationId={id} />;
}
