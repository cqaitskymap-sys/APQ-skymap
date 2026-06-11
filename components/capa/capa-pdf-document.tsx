'use client';

import type {
  CapaRecord, CapaAction, CapaEffectiveness, CapaApproval, CapaSourceLink,
} from '@/lib/capa-types';

interface CapaPdfDocumentProps {
  record: CapaRecord;
  actions: CapaAction[];
  effectiveness: CapaEffectiveness | null;
  approvals: CapaApproval[];
  sourceLinks: CapaSourceLink[];
  auditLogs: Record<string, unknown>[];
}

export function CapaPdfDocument({
  record, actions, effectiveness, approvals, sourceLinks, auditLogs,
}: CapaPdfDocumentProps) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

  return (
    <article id="capa-pdf-document" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">Corrective & Preventive Action Report</p>
            <p className="text-[10px] mt-1">GMP Compliant | 21 CFR Part 11</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Format No.:</strong> SOP/QA/CAPA/F01-01</p>
            <p><strong>Effective Date:</strong> {fmt(record.created_at)}</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase">CAPA Report</h1>
          <p className="font-mono font-bold text-sm mt-1">{record.capa_number}</p>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 CAPA Details</h2>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['CAPA Number', record.capa_number],
              ['CAPA Date', fmt(record.capa_date)],
              ['Source', record.capa_source],
              ['Source Reference', record.source_reference_number],
              ['Department', record.department],
              ['Product', record.product_name],
              ['Batch', record.batch_number || '—'],
              ['Priority', record.priority],
              ['Status', record.capa_status.replace(/_/g, ' ')],
              ['Action Owner', record.action_owner_name],
              ['Target Completion', fmt(record.target_completion_date)],
              ['Actual Completion', fmt(record.actual_completion_date)],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{label}</td>
                <td className="border border-black p-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Problem & Root Cause</h2>
        <p className="border border-black p-2 mb-2"><strong>Title:</strong> {record.capa_title}</p>
        <p className="border border-black p-2 mb-2"><strong>Problem:</strong> {record.problem_description}</p>
        <p className="border border-black p-2"><strong>Root Cause:</strong> {record.root_cause || '—'}</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Corrective & Preventive Actions</h2>
        <p className="border border-black p-2 mb-2"><strong>Corrective:</strong> {record.corrective_action || '—'}</p>
        <p className="border border-black p-2"><strong>Preventive:</strong> {record.preventive_action || '—'}</p>
      </section>

      {actions.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Implementation Evidence</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Type</th>
              <th className="border border-black p-1">Description</th>
              <th className="border border-black p-1">Owner</th>
              <th className="border border-black p-1">Completed</th>
            </tr></thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="border border-black p-1 capitalize">{a.action_type}</td>
                  <td className="border border-black p-1">{a.description}</td>
                  <td className="border border-black p-1">{a.owner_name}</td>
                  <td className="border border-black p-1">{fmt(a.completed_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {effectiveness && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Effectiveness Check</h2>
          <table className="w-full border border-black text-[10px]">
            <tbody>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50 w-1/3">Check Date</td><td className="border border-black p-1.5">{fmt(effectiveness.check_date)}</td></tr>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Criteria</td><td className="border border-black p-1.5">{effectiveness.criteria}</td></tr>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Result</td><td className="border border-black p-1.5">{effectiveness.result}</td></tr>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Evidence</td><td className="border border-black p-1.5">{effectiveness.evidence}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {approvals.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">6.0 Approval Signatures</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Approver</th>
              <th className="border border-black p-1">Level</th>
              <th className="border border-black p-1">Decision</th>
              <th className="border border-black p-1">E-Signature</th>
              <th className="border border-black p-1">Date</th>
            </tr></thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td className="border border-black p-1">{a.approver_name}</td>
                  <td className="border border-black p-1">{a.approval_level}</td>
                  <td className="border border-black p-1 capitalize">{a.decision}</td>
                  <td className="border border-black p-1 font-mono">{a.e_signature}</td>
                  <td className="border border-black p-1">{fmt(a.signed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">7.0 Audit Trail Summary</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1">Action</th>
            <th className="border border-black p-1">User</th>
            <th className="border border-black p-1">Date</th>
          </tr></thead>
          <tbody>
            {auditLogs.slice(0, 15).map((log, i) => (
              <tr key={i}>
                <td className="border border-black p-1">{String(log.action || '')}</td>
                <td className="border border-black p-1">{String(log.userName || log.user_name || '')}</td>
                <td className="border border-black p-1">{fmt(String(log.dateTime || log.timestamp || ''))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {sourceLinks.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Source Links</h2>
          <p className="border border-black p-2 text-[10px]">
            {sourceLinks.map((l) => `${l.source_type}: ${l.source_number}`).join(' | ')}
          </p>
        </section>
      )}

      <footer className="text-[9px] text-center border-t border-black pt-2 mt-6">
        This document is generated electronically and is valid without a wet signature when e-signatures are recorded above.
      </footer>
    </article>
  );
}
