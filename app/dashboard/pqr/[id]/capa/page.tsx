'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage, PqrRecordsTable, PqrSummaryCard } from '@/components/pqr/pqr-section-page';

export default function PqrCapaPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="CAPA Review" description="Corrective and Preventive Action summary">
      {({ snapshot }) => (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <PqrSummaryCard title="Total CAPA" value={snapshot?.capa.total ?? 0} />
            <PqrSummaryCard title="Open" value={snapshot?.capa.open ?? 0} />
          </div>
          <PqrRecordsTable columns={[{ key: 'capa_number', label: 'CAPA No.' }, { key: 'title', label: 'Title' }, { key: 'capa_type', label: 'Type' }, { key: 'status', label: 'Status' }]} records={snapshot?.capa.records ?? []} />
        </>
      )}
    </PqrSectionPage>
  );
}
