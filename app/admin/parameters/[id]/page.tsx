'use client';;
import { use } from "react";

import { ParameterAccessGuard } from '@/components/admin/parameters/parameter-access-guard';
import { ParameterDetailView } from '@/components/admin/parameters/parameter-detail-view';

export default function ParameterDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <ParameterAccessGuard>
      <ParameterDetailView id={params.id} />
    </ParameterAccessGuard>
  );
}
