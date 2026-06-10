'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PqrSectionPage, PqrRecordsTable } from '@/components/pqr/pqr-section-page';

export default function PqrStabilityPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Stability Review" description="Stability study status for the product">
      {({ snapshot, document }) => (
        <>
          <Card className="mb-4"><CardContent className="p-4 text-sm">{snapshot?.stability.summary || document?.stability_status || 'Stability program maintained per ICH guidelines.'}</CardContent></Card>
          <PqrRecordsTable columns={[{ key: 'study_number', label: 'Study' }, { key: 'status', label: 'Status' }, { key: 'batch_number', label: 'Batch' }]} records={snapshot?.stability.records ?? []} />
        </>
      )}
    </PqrSectionPage>
  );
}
