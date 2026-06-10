'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage } from '@/components/pqr/pqr-section-page';
import { PqrSummaryForm } from '@/components/pqr/pqr-summary-form';

export default function PqrSummaryPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Summary & Conclusion" description="Observations, conclusions, and recommendations" showRefresh={false}>
      {({ document, snapshot, reload }) =>
        document ? <PqrSummaryForm pqrId={pqrId} document={document} snapshot={snapshot} onSaved={reload} /> : null
      }
    </PqrSectionPage>
  );
}
