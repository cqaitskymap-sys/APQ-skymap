'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage, PqrRecordsTable, PqrSummaryCard } from '@/components/pqr/pqr-section-page';

export default function PqrBatchReviewPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Batch Review" description="Manufacturing batch summary auto-pulled from Batch Module">
      {({ snapshot }) => (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <PqrSummaryCard title="Manufactured" value={snapshot?.batches.manufactured ?? 0} />
            <PqrSummaryCard title="Released" value={snapshot?.batches.released ?? 0} />
            <PqrSummaryCard title="Rejected" value={snapshot?.batches.rejected ?? 0} />
            <PqrSummaryCard title="Reworked" value={snapshot?.batches.reworked ?? 0} />
            <PqrSummaryCard title="Reprocessed" value={snapshot?.batches.reprocessed ?? 0} />
          </div>
          <PqrRecordsTable
            columns={[
              { key: 'batch_number', label: 'Batch No.' },
              { key: 'batchNo', label: 'Alt No.' },
              { key: 'manufacturing_date', label: 'Mfg Date' },
              { key: 'status', label: 'Status' },
            ]}
            records={snapshot?.batches.records ?? []}
          />
        </>
      )}
    </PqrSectionPage>
  );
}
