'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EbmrStatusBadge } from './ebmr-sub-nav';
import type {
  EbmrRecord, LineClearanceRecord, EbmrDispensingRecord, ManufacturingStepRecord,
  EquipmentUsageRecord, CppRecord, IpcCheckRecord, EbmrReviewRecord, EbmrReleaseRecord,
} from '@/lib/ebmr-mgmt-types';

export function EbmrRecordsTable({ records }: { records: EbmrRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>eBMR No</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead>
      <TableHead>MFG</TableHead><TableHead>EXP</TableHead><TableHead>Status</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No batch records</TableCell></TableRow>
        : records.map((r) => (
          <TableRow key={r.id}>
            <TableCell><Link href={`/qms/ebmr/${r.id}`} className="font-mono text-blue-600 hover:underline">{r.ebmr_number}</Link></TableCell>
            <TableCell>{r.product_name}</TableCell><TableCell>{r.batch_number}</TableCell>
            <TableCell>{r.mfg_date}</TableCell><TableCell>{r.exp_date}</TableCell>
            <TableCell><EbmrStatusBadge status={r.batch_status} /></TableCell>
          </TableRow>
        ))}
    </TableBody></Table>
  );
}

export function LineClearanceTable({ records }: { records: LineClearanceRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Area</TableHead><TableHead>Room</TableHead><TableHead>Done By</TableHead>
      <TableHead>QA Verified</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.area_name}</TableCell><TableCell>{r.room_number}</TableCell>
          <TableCell>{r.line_clearance_done_by_name}</TableCell>
          <TableCell>{r.qa_verified_by_name || '—'}</TableCell>
          <TableCell>{r.clearance_datetime}</TableCell>
          <TableCell><EbmrStatusBadge status={r.status} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function DispensingTable({ records }: { records: EbmrDispensingRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Material</TableHead><TableHead>AR No</TableHead><TableHead>Required</TableHead>
      <TableHead>Dispensed</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.material_name}</TableCell><TableCell>{r.ar_number}</TableCell>
          <TableCell>{r.required_quantity} {r.unit}</TableCell>
          <TableCell>{r.dispensed_quantity} {r.unit}</TableCell>
          <TableCell>{r.balance_quantity}</TableCell>
          <TableCell><EbmrStatusBadge status={r.status} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function ManufacturingStepsTable({ records }: { records: ManufacturingStepRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Step</TableHead><TableHead>Stage</TableHead><TableHead>Performed By</TableHead>
      <TableHead>Observed</TableHead><TableHead>Status</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.step_number}</TableCell><TableCell>{r.process_stage}</TableCell>
          <TableCell>{r.performed_by_name}</TableCell><TableCell>{r.observed_value || '—'}</TableCell>
          <TableCell><EbmrStatusBadge status={r.status} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function EquipmentUsageTable({ records }: { records: EquipmentUsageRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Equipment</TableHead><TableHead>Stage</TableHead><TableHead>Cleaning</TableHead>
      <TableHead>Sterilization</TableHead><TableHead>Compliance</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.equipment_id} — {r.equipment_name}</TableCell><TableCell>{r.process_stage}</TableCell>
          <TableCell><EbmrStatusBadge status={r.cleaning_status} /></TableCell>
          <TableCell><EbmrStatusBadge status={r.sterilization_status} /></TableCell>
          <TableCell><EbmrStatusBadge status={r.compliance_status} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function CppRecordsTable({ records }: { records: CppRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Stage</TableHead><TableHead>Parameter</TableHead><TableHead>Target</TableHead>
      <TableHead>LSL-USL</TableHead><TableHead>Observed</TableHead><TableHead>Status</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.process_stage}</TableCell><TableCell>{r.parameter_name}</TableCell>
          <TableCell>{r.target} {r.unit}</TableCell>
          <TableCell>{r.lsl} — {r.usl}</TableCell>
          <TableCell>{r.observed_value}</TableCell>
          <TableCell><EbmrStatusBadge status={r.status} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function IpcChecksTable({ records }: { records: IpcCheckRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Check</TableHead><TableHead>Spec</TableHead><TableHead>Result</TableHead>
      <TableHead>Checked By</TableHead><TableHead>Status</TableHead><TableHead>Ref</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.check_name}</TableCell><TableCell>{r.specification}</TableCell>
          <TableCell>{r.observed_result} {r.unit}</TableCell>
          <TableCell>{r.checked_by_name}</TableCell>
          <TableCell><EbmrStatusBadge status={r.status} /></TableCell>
          <TableCell>{r.linked_deviation_id || r.linked_oos_id || '—'}</TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function ReviewsTable({ records }: { records: EbmrReviewRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Type</TableHead><TableHead>Reviewer</TableHead><TableHead>Date</TableHead><TableHead>Decision</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.review_type}</TableCell><TableCell>{r.reviewer_name}</TableCell>
          <TableCell>{r.review_date}</TableCell>
          <TableCell><EbmrStatusBadge status={r.decision} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}

export function ReleasesTable({ records }: { records: EbmrReleaseRecord[] }) {
  return (
    <Table><TableHeader><TableRow>
      <TableHead>Release No</TableHead><TableHead>By</TableHead><TableHead>Date</TableHead><TableHead>Decision</TableHead>
    </TableRow></TableHeader><TableBody>
      {records.map((r) => (
        <TableRow key={r.id}>
          <TableCell>{r.release_number}</TableCell><TableCell>{r.released_by_name}</TableCell>
          <TableCell>{r.release_date}</TableCell>
          <TableCell><EbmrStatusBadge status={r.decision} /></TableCell>
        </TableRow>
      ))}</TableBody></Table>
  );
}
