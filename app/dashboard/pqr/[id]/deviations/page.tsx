'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage, PqrRecordsTable, PqrSummaryCard } from '@/components/pqr/pqr-section-page';

export default function PqrDeviationsPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Deviations Review" description="Deviation summary from QMS Deviation Module">
      {({ snapshot }) => (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <PqrSummaryCard title="Total Deviations" value={snapshot?.deviations.total ?? 0} />
            <PqrSummaryCard title="Open" value={snapshot?.deviations.open ?? 0} />
          </div>
          <PqrRecordsTable columns={[{ key: 'deviation_number', label: 'Dev No.' }, { key: 'title', label: 'Title' }, { key: 'deviation_type', label: 'Type' }, { key: 'status', label: 'Status' }]} records={snapshot?.deviations.records ?? []} />
        </>
      )}
    </PqrSectionPage>
  );
}
