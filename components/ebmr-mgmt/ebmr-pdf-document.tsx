'use client';

import type {
  EbmrRecord, LineClearanceRecord, EbmrDispensingRecord, ManufacturingStepRecord,
  EquipmentUsageRecord, CppRecord, IpcCheckRecord, EbmrReviewRecord, EbmrReleaseRecord,
} from '@/lib/ebmr-mgmt-types';

export function EbmrFullPdfDocument({
  record, lineClearance, dispensing, steps, equipment, cpp, ipc, reviews, releases,
  reportTitle = 'Complete eBMR Report',
}: {
  record: EbmrRecord;
  lineClearance: LineClearanceRecord[];
  dispensing: EbmrDispensingRecord[];
  steps: ManufacturingStepRecord[];
  equipment: EquipmentUsageRecord[];
  cpp: CppRecord[];
  ipc: IpcCheckRecord[];
  reviews: EbmrReviewRecord[];
  releases: EbmrReleaseRecord[];
  reportTitle?: string;
}) {
  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 space-y-6 print:p-4" id="ebmr-report">
      <header className="border-b pb-4">
        <h1 className="text-xl font-bold">{reportTitle}</h1>
        <p className="text-sm text-gray-600">{record.ebmr_number} | Batch {record.batch_number} | {record.product_name}</p>
        <p className="text-xs text-gray-500">Generated {new Date().toLocaleDateString()} — GMP Electronic Batch Manufacturing Record</p>
      </header>
      <section>
        <h2 className="font-semibold mb-2">Batch Header</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>{[
            ['eBMR Number', record.ebmr_number], ['Product', record.product_name], ['Generic', record.generic_name],
            ['Strength', record.strength], ['Batch No', record.batch_number], ['Batch Size', record.batch_size],
            ['Batch Size (L)', record.batch_size_litres != null ? String(record.batch_size_litres) : '—'],
            ['Std. Fill Vol. (mL)', record.std_fill_volume_ml != null ? String(record.std_fill_volume_ml) : '—'],
            ['Batch Size (Nos.)', record.batch_size_nos != null ? String(record.batch_size_nos) : '—'],
            ['MFG Date', record.mfg_date], ['EXP Date', record.exp_date], ['BMR Version', record.bmr_version],
            ['Mfg Area', record.manufacturing_area], ['Status', record.batch_status],
            ['Created By', record.created_by_name], ['Reviewed By', record.reviewed_by_name || '—'],
            ['Approved By', record.approved_by_name || '—'],
          ].map(([k, v]) => (
            <tr key={k} className="border-b"><td className="py-1 pr-4 font-medium w-40">{k}</td><td>{v}</td></tr>
          ))}</tbody>
        </table>
      </section>
      {lineClearance.length > 0 && (
        <section><h2 className="font-semibold mb-2">Line Clearance</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Area</th><th className="p-1 border">Room</th><th className="p-1 border">QA Verified</th><th className="p-1 border">Status</th>
          </tr></thead><tbody>{lineClearance.map((r) => (
            <tr key={r.id}><td className="p-1 border">{r.area_name}</td><td className="p-1 border">{r.room_number}</td>
              <td className="p-1 border">{r.qa_verified_by_name || '—'}</td><td className="p-1 border">{r.status}</td></tr>
          ))}</tbody></table>
        </section>
      )}
      {dispensing.length > 0 && (
        <section><h2 className="font-semibold mb-2">Dispensing Verification</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Material</th><th className="p-1 border">Code</th><th className="p-1 border">AR No</th>
            <th className="p-1 border">Mfg/Exp</th><th className="p-1 border">Required</th><th className="p-1 border">Dispensed</th><th className="p-1 border">Status</th>
          </tr></thead><tbody>{dispensing.map((r) => (
            <tr key={r.id}><td className="p-1 border">{r.material_name}</td><td className="p-1 border">{r.material_code || '—'}</td><td className="p-1 border">{r.ar_number}</td>
              <td className="p-1 border">{r.material_mfg_date || '—'} / {r.material_exp_date || '—'}</td>
              <td className="p-1 border">{r.required_quantity} {r.unit}</td><td className="p-1 border">{r.dispensed_quantity}</td><td className="p-1 border">{r.status}</td></tr>
          ))}</tbody></table>
        </section>
      )}
      {steps.length > 0 && (
        <section><h2 className="font-semibold mb-2">Manufacturing Steps</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Step</th><th className="p-1 border">Stage</th><th className="p-1 border">Performed By</th><th className="p-1 border">Status</th>
          </tr></thead><tbody>{steps.map((r) => (
            <tr key={r.id}><td className="p-1 border">{r.step_number}</td><td className="p-1 border">{r.process_stage}</td>
              <td className="p-1 border">{r.performed_by_name}</td><td className="p-1 border">{r.status}</td></tr>
          ))}</tbody></table>
        </section>
      )}
      {cpp.length > 0 && (
        <section><h2 className="font-semibold mb-2">CPP Records</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Parameter</th><th className="p-1 border">Target</th><th className="p-1 border">Observed</th><th className="p-1 border">Status</th>
          </tr></thead><tbody>{cpp.map((r) => (
            <tr key={r.id}><td className="p-1 border">{r.parameter_name}</td><td className="p-1 border">{r.target}</td>
              <td className="p-1 border">{r.observed_value}</td><td className="p-1 border">{r.status}</td></tr>
          ))}</tbody></table>
        </section>
      )}
      {ipc.length > 0 && (
        <section><h2 className="font-semibold mb-2">IPC Checks</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Check</th><th className="p-1 border">Result</th><th className="p-1 border">Status</th>
          </tr></thead><tbody>{ipc.map((r) => (
            <tr key={r.id}><td className="p-1 border">{r.check_name}</td><td className="p-1 border">{r.observed_result}</td><td className="p-1 border">{r.status}</td></tr>
          ))}</tbody></table>
        </section>
      )}
      {releases.length > 0 && (
        <section><h2 className="font-semibold mb-2">Batch Release</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Release No</th><th className="p-1 border">By</th><th className="p-1 border">Date</th><th className="p-1 border">Decision</th>
          </tr></thead><tbody>{releases.map((r) => (
            <tr key={r.id}><td className="p-1 border">{r.release_number}</td><td className="p-1 border">{r.released_by_name}</td>
              <td className="p-1 border">{r.release_date}</td><td className="p-1 border">{r.decision}</td></tr>
          ))}</tbody></table>
        </section>
      )}
    </div>
  );
}

export function EbmrSectionPdf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 space-y-4 print:p-4" id="ebmr-section-report">
      <header className="border-b pb-4"><h1 className="text-xl font-bold">{title}</h1></header>
      {children}
    </div>
  );
}
