'use client';

import { useParams } from 'next/navigation';
import { OosApprovalPageShell } from '@/components/oos/approval/oos-approval-page';

export default function Page() {
  const id = useParams().id as string;
  return <OosApprovalPageShell oosId={id} />;
}
