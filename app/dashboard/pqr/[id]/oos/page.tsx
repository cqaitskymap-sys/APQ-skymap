'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage, PqrRecordsTable, PqrSummaryCard } from '@/components/pqr/pqr-section-page';

export default function PqrOosPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="OOS Review" description="Out-of-Specification investigations">
      {({ snapshot }) => (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <PqrSummaryCard title="Total OOS" value={snapshot?.oos.total ?? 0} />
            <PqrSummaryCard title="Open" value={snapshot?.oos.open ?? 0} />
          </div>
          <PqrRecordsTable columns={[{ key: 'oos_number', label: 'OOS No.' }, { key: 'batch_number', label: 'Batch' }, { key: 'test_parameter', label: 'Parameter' }, { key: 'status', label: 'Status' }]} records={snapshot?.oos.records ?? []} />
        </>
      )}
    </PqrSectionPage>
  );
}
