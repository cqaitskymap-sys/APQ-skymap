'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PqrSectionPage, PqrRecordsTable } from '@/components/pqr/pqr-section-page';

export default function PqrMaterialsPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Material Review" description="API and raw material review data">
      {({ snapshot }) => (
        <>
          <div className="flex gap-2 mb-4">
            <Link href={`/dashboard/pqr/${pqrId}/materials/create`}><Button size="sm" className="gap-1 bg-blue-600"><Plus className="h-3.5 w-3.5" />Add Review</Button></Link>
          </div>
          <PqrRecordsTable
            columns={[
              { key: 'batchNo', label: 'Batch' },
              { key: 'materialName', label: 'Material' },
              { key: 'materialType', label: 'Type' },
              { key: 'complianceStatus', label: 'Compliance' },
            ]}
            records={snapshot?.materials.records ?? []}
          />
        </>
      )}
    </PqrSectionPage>
  );
}
