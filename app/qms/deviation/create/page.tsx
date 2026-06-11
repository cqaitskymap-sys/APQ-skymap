'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DeviationForm } from '@/components/deviations/deviation-form';
import { createDeviation } from '@/lib/deviation-service';
import { useDeviationActor } from '@/hooks/use-deviations';
import type { DeviationCreateInput } from '@/lib/deviation-schemas';
import type { DeviationRecord } from '@/lib/deviation-types';

export default function CreateDeviationPage() {
  const router = useRouter();
  const actor = useDeviationActor();

  const handleSubmit = async (data: DeviationCreateInput) => {
    try {
      const record = await createDeviation({
        ...data,
        title: data.title,
        description: data.description,
        department: data.department,
        product_name: data.product_name,
        area: data.area,
        category: data.category,
        criticality: data.criticality as DeviationRecord['criticality'],
        planned_type: data.planned_type as DeviationRecord['planned_type'],
        immediate_action: data.immediate_action,
        reported_by_name: data.reported_by_name,
        detected_by_name: data.detected_by_name,
        deviation_date: data.deviation_date,
        batch_number: data.batch_number,
        batch_impacted: data.batch_impacted,
        product_quality_impacted: data.product_quality_impacted,
        patient_safety_impacted: data.patient_safety_impacted,
        regulatory_impact: data.regulatory_impact,
        repeat_deviation: data.repeat_deviation,
        target_closure_date: data.target_closure_date || null,
        qa_remarks: data.qa_remarks,
      }, actor);
      toast.success(`Deviation ${record.deviation_number} created`);
      router.push(`/qms/deviation/${record.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create deviation');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Deviation</h1>
        <p className="text-muted-foreground text-sm">Report a new GMP deviation — saved as draft until submitted</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Deviation Report Form</CardTitle>
          <CardDescription>
            Batch number links to PQR and CPV batch data. Product quality impact automatically mandates CAPA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviationForm submitLabel="Save as Draft" onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
