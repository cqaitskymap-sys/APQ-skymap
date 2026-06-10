'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage, PqrRecordsTable } from '@/components/pqr/pqr-section-page';

export default function PqrChangeControlPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Change Control Review" description="Change control records during review period">
      {({ snapshot }) => (
        <PqrRecordsTable columns={[{ key: 'change_number', label: 'CC No.' }, { key: 'title', label: 'Title' }, { key: 'status', label: 'Status' }]} records={snapshot?.changeControl.records ?? []} />
      )}
    </PqrSectionPage>
  );
}
