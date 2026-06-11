'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EbmrBatchSectionPage } from '@/components/ebmr-mgmt/ebmr-detail-view';
import {
  LineClearanceForm, DispensingForm, ManufacturingStepForm, EquipmentUsageForm,
  CppRecordForm, IpcCheckForm, EbmrReviewForm, EbmrReleaseForm,
} from '@/components/ebmr-mgmt/ebmr-forms';
import {
  LineClearanceTable, DispensingTable, ManufacturingStepsTable, EquipmentUsageTable,
  CppRecordsTable, IpcChecksTable, ReviewsTable, ReleasesTable,
} from '@/components/ebmr-mgmt/ebmr-entity-list';
import {
  getEbmrById, listLineClearance, listEbmrDispensing, listManufacturingSteps,
  listEquipmentUsage, listCppRecords, listIpcChecks, listEbmrReviews, listEbmrReleases,
} from '@/lib/ebmr-mgmt-service';
import type {
  EbmrRecord, LineClearanceRecord, EbmrDispensingRecord, ManufacturingStepRecord,
  EquipmentUsageRecord, CppRecord, IpcCheckRecord, EbmrReviewRecord, EbmrReleaseRecord,
} from '@/lib/ebmr-mgmt-types';
import { isEbmrReadOnly } from '@/lib/ebmr-mgmt-types';
import { useEbmrActor } from '@/hooks/use-ebmr-mgmt';

function useBatchSection<T>(
  loader: (id: string) => Promise<T[]>,
): { record: EbmrRecord | null; items: T[]; loading: boolean; refresh: () => Promise<void> } {
  const id = useParams().id as string;
  const [record, setRecord] = useState<EbmrRecord | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const [rec, data] = await Promise.all([getEbmrById(id), loader(id)]);
    setRecord(rec);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [id]);
  return { record, items, loading, refresh };
}

export function LineClearancePage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<LineClearanceRecord>(listLineClearance);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="Line Clearance" description="Area and equipment line clearance verification before batch start"
      form={!isEbmrReadOnly(actor.role) ? <LineClearanceForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<LineClearanceTable records={items} />} />
  );
}

export function DispensingPage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<EbmrDispensingRecord>(listEbmrDispensing);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="Dispensing Verification" description="Material dispensing and balance verification"
      form={!isEbmrReadOnly(actor.role) ? <DispensingForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<DispensingTable records={items} />} />
  );
}

export function ManufacturingPage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<ManufacturingStepRecord>(listManufacturingSteps);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="Manufacturing Steps" description="Batch execution steps from dispensing through packing"
      form={!isEbmrReadOnly(actor.role) ? <ManufacturingStepForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<ManufacturingStepsTable records={items} />} />
  );
}

export function EquipmentPage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<EquipmentUsageRecord>(listEquipmentUsage);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="Equipment Usage" description="Equipment qualification, cleaning, sterilization and usage log"
      form={!isEbmrReadOnly(actor.role) ? <EquipmentUsageForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<EquipmentUsageTable records={items} />} />
  );
}

export function CppPage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<CppRecord>(listCppRecords);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="CPP Recording" description="Critical Process Parameter monitoring — OOT triggers deviation draft"
      form={!isEbmrReadOnly(actor.role) ? <CppRecordForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<CppRecordsTable records={items} />} />
  );
}

export function IpcPage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<IpcCheckRecord>(listIpcChecks);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="IPC Checks" description="In-process quality checks — failures create OOS or deviation drafts"
      form={!isEbmrReadOnly(actor.role) ? <IpcCheckForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<IpcChecksTable records={items} />} />
  );
}

export function ReviewPage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<EbmrReviewRecord>(listEbmrReviews);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="Batch Review" description="QA review and approval before batch release"
      form={!isEbmrReadOnly(actor.role) ? <EbmrReviewForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<ReviewsTable records={items} />} />
  );
}

export function ReleasePage() {
  const actor = useEbmrActor();
  const { record, items, loading, refresh } = useBatchSection<EbmrReleaseRecord>(listEbmrReleases);
  if (loading || !record) return <LoadingSpinner />;
  return (
    <EbmrBatchSectionPage record={record} title="Batch Release" description="Head QA final batch release — locks eBMR on release"
      form={!isEbmrReadOnly(actor.role) ? <EbmrReleaseForm ebmr={record} onSuccess={refresh} /> : undefined}
      table={<ReleasesTable records={items} />} />
  );
}
