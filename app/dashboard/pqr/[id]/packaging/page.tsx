'use client';

import { useParams } from 'next/navigation';
import { PqrSectionPage, PqrRecordsTable } from '@/components/pqr/pqr-section-page';

export default function PqrPackagingPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Packaging Review" description="Packaging material review and reconciliation">
      {({ snapshot }) => (
        <PqrRecordsTable
          columns={[
            { key: 'batchNo', label: 'Batch' },
            { key: 'packagingMaterial', label: 'Material' },
            { key: 'qcStatus', label: 'QC Status' },
            { key: 'complianceStatus', label: 'Compliance' },
          ]}
          records={snapshot?.packaging.records ?? []}
        />
      )}
    </PqrSectionPage>
  );
}
