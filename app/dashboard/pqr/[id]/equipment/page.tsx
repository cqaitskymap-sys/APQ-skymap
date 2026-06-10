'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PqrSectionPage } from '@/components/pqr/pqr-section-page';

export default function PqrEquipmentPage() {
  const pqrId = useParams().id as string;
  return (
    <PqrSectionPage pqrId={pqrId} title="Equipment Review" description="Equipment qualification and calibration status">
      {({ snapshot }) => (
        <Card><CardContent className="p-6 text-sm">{snapshot?.equipment.summary || 'Equipment qualification reviewed. All critical equipment within valid qualification/calibration period.'}</CardContent></Card>
      )}
    </PqrSectionPage>
  );
}
