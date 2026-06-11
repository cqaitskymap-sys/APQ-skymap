'use client';

import type {
  StabilityStudy, StabilitySchedule, StabilitySamplePull,
  StabilityResult, StabilityApproval,
} from '@/lib/stability-types';

interface StabilityPdfDocumentProps {
  record: StabilityStudy;
  schedules: StabilitySchedule[];
  pulls: StabilitySamplePull[];
  results: StabilityResult[];
  approvals: StabilityApproval[];
  auditLogs: Record<string, unknown>[];
}

export function StabilityPdfDocument({
  record, schedules, pulls, results, approvals, auditLogs,
}: StabilityPdfDocumentProps) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const oosOot = results.filter((r) => ['OOS', 'OOT'].includes(r.result_status));
  const conclusion = oosOot.length === 0
    ? 'All stability results comply with approved specifications. Batch meets shelf-life requirements.'
    : `${oosOot.length} OOS/OOT result(s) identified — refer to investigation records.`;

  return (
    <article className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">Stability Study Report</p>
            <p className="text-[10px] mt-1">GMP Compliant | ICH Q1A</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Format No.:</strong> SOP/QA/STAB/F01-01</p>
            <p><strong>Date:</strong> {fmt(record.created_at)}</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase">Stability Study Report</h1>
          <p className="font-mono font-bold text-sm mt-1">{record.stability_study_number}</p>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Study Details</h2>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Study Number', record.stability_study_number],
              ['Product', record.product_name],
              ['Batch', record.batch_number],
              ['Study Type', record.study_type],
              ['Storage Condition', record.storage_condition],
              ['Protocol', `${record.protocol_number} v${record.protocol_version}`],
              ['Initiation Date', fmt(record.study_initiation_date)],
              ['Status', record.status.replace(/_/g, ' ')],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{label}</td>
                <td className="border border-black p-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {schedules.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Testing Schedule</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Interval</th>
              <th className="border border-black p-1">Scheduled Date</th>
              <th className="border border-black p-1">Status</th>
            </tr></thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className="border border-black p-1">{s.interval}</td>
                  <td className="border border-black p-1">{fmt(s.scheduled_date)}</td>
                  <td className="border border-black p-1 capitalize">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {pulls.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Sample Pulling History</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Interval</th>
              <th className="border border-black p-1">Due</th>
              <th className="border border-black p-1">Actual</th>
              <th className="border border-black p-1">Status</th>
            </tr></thead>
            <tbody>
              {pulls.map((p) => (
                <tr key={p.id}>
                  <td className="border border-black p-1">{p.interval}</td>
                  <td className="border border-black p-1">{fmt(p.pulling_due_date)}</td>
                  <td className="border border-black p-1">{fmt(p.actual_pulling_date)}</td>
                  <td className="border border-black p-1">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Test Results</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Interval</th>
              <th className="border border-black p-1">Parameter</th>
              <th className="border border-black p-1">Result</th>
              <th className="border border-black p-1">Status</th>
            </tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="border border-black p-1">{r.interval}</td>
                  <td className="border border-black p-1">{r.parameter_name}</td>
                  <td className="border border-black p-1">{r.observed_result} {r.unit}</td>
                  <td className="border border-black p-1">{r.result_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {oosOot.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 OOS/OOT Summary</h2>
          {oosOot.map((r) => (
            <p key={r.id} className="border border-black border-b-0 last:border-b p-2">
              {r.parameter_name} at {r.interval}: {r.result_status} — {r.observed_result} {r.unit}
              {r.linked_oos_number ? ` (OOS: ${r.linked_oos_number})` : ''}
            </p>
          ))}
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">6.0 Conclusion</h2>
        <p className="border border-black p-3">{conclusion}</p>
      </section>

      {approvals.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">7.0 Approval Signatures</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Approver</th>
              <th className="border border-black p-1">Decision</th>
              <th className="border border-black p-1">Signature</th>
              <th className="border border-black p-1">Date</th>
            </tr></thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td className="border border-black p-1">{a.approver_name}</td>
                  <td className="border border-black p-1 capitalize">{a.decision}</td>
                  <td className="border border-black p-1 italic">{a.e_signature}</td>
                  <td className="border border-black p-1">{fmt(a.signed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">8.0 Audit Trail Summary</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1">Action</th>
            <th className="border border-black p-1">User</th>
            <th className="border border-black p-1">Timestamp</th>
          </tr></thead>
          <tbody>
            {auditLogs.slice(0, 15).map((log, i) => (
              <tr key={i}>
                <td className="border border-black p-1">{String(log.action || '')}</td>
                <td className="border border-black p-1">{String(log.userName || '')}</td>
                <td className="border border-black p-1">{String(log.dateTime || '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="text-[9px] text-center border-t border-black pt-2 mt-6">
        Electronically generated from Skymap QMS Stability Module. Uncontrolled if printed.
      </footer>
    </article>
  );
}
