'use client';

import type {
  ChangeControlRecord, ChangeImpactAssessment, ChangeRiskAssessment,
  ChangeImplementationAction, ChangeEffectivenessReview, ChangeApproval,
} from '@/lib/change-control-types';

interface CcPdfDocumentProps {
  record: ChangeControlRecord;
  impact: ChangeImpactAssessment | null;
  risk: ChangeRiskAssessment | null;
  actions: ChangeImplementationAction[];
  effectiveness: ChangeEffectivenessReview | null;
  approvals: ChangeApproval[];
  auditLogs: Record<string, unknown>[];
}

export function CcPdfDocument({
  record, impact, risk, actions, effectiveness, approvals, auditLogs,
}: CcPdfDocumentProps) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';

  return (
    <article className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">Change Control Report</p>
            <p className="text-[10px] mt-1">GMP Compliant | 21 CFR Part 11</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Format No.:</strong> SOP/QA/CC/F01-01</p>
            <p><strong>Effective Date:</strong> {fmt(record.created_at)}</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase">Change Control Report</h1>
          <p className="font-mono font-bold text-sm mt-1">{record.change_control_number}</p>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Change Details</h2>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Change Control Number', record.change_control_number],
              ['Change Date', fmt(record.change_date)],
              ['Department', record.department],
              ['Initiated By', record.initiated_by_name],
              ['Product', record.product_name || '—'],
              ['Batch', record.batch_number || '—'],
              ['Change Type', record.change_type],
              ['Category', record.change_category],
              ['Priority', record.change_priority],
              ['Status', record.status.replace(/_/g, ' ')],
              ['Planned Implementation', fmt(record.planned_implementation_date)],
              ['Actual Implementation', fmt(record.actual_implementation_date)],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{label}</td>
                <td className="border border-black p-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border border-black border-t-0 p-2"><strong>Title:</strong> {record.change_title}</p>
        <p className="border border-black border-t-0 p-2"><strong>Description:</strong> {record.change_description}</p>
        <p className="border border-black border-t-0 p-2"><strong>Current System/Process:</strong> {record.current_system}</p>
        <p className="border border-black border-t-0 p-2"><strong>Proposed Change:</strong> {record.proposed_change}</p>
        <p className="border border-black border-t-0 p-2"><strong>Reason:</strong> {record.reason_for_change}</p>
      </section>

      {impact && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Impact Assessment</h2>
          <table className="w-full border border-black text-[10px]">
            <tbody>
              {Object.entries(impact).filter(([k]) => !['id', 'change_id', 'assessed_by', 'assessed_by_name', 'assessed_at', 'created_at', 'updated_at'].includes(k)).map(([k, v]) => (
                <tr key={k}>
                  <td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50 capitalize">{k.replace(/_/g, ' ')}</td>
                  <td className="border border-black p-1.5">{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {risk && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Risk Assessment</h2>
          <table className="w-full border border-black text-[10px]">
            <tbody>
              {[['Severity', risk.severity], ['Occurrence', risk.occurrence], ['Detectability', risk.detectability], ['RPN', risk.rpn], ['Risk Level', risk.risk_level]].map(([l, v]) => (
                <tr key={String(l)}><td className="border border-black p-1.5 font-semibold bg-slate-50">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="border border-black border-t-0 p-2"><strong>Mitigation Plan:</strong> {risk.mitigation_plan}</p>
        </section>
      )}

      {actions.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Implementation Plan</h2>
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className="border border-black p-1">Action</th>
              <th className="border border-black p-1">Owner</th>
              <th className="border border-black p-1">Target</th>
              <th className="border border-black p-1">Status</th>
            </tr></thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="border border-black p-1">{a.action_item}</td>
                  <td className="border border-black p-1">{a.responsible_person_name}</td>
                  <td className="border border-black p-1">{fmt(a.target_date)}</td>
                  <td className="border border-black p-1 capitalize">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {effectiveness && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Effectiveness Review</h2>
          <p className="border border-black p-2"><strong>Criteria:</strong> {effectiveness.effectiveness_criteria}</p>
          <p className="border border-black border-t-0 p-2"><strong>Result:</strong> {effectiveness.result}</p>
          <p className="border border-black border-t-0 p-2"><strong>Conclusion:</strong> {effectiveness.conclusion}</p>
          <p className="border border-black border-t-0 p-2"><strong>Reviewed By:</strong> {effectiveness.reviewed_by_name} on {fmt(effectiveness.review_date)}</p>
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
              <th className="border border-black p-1">Signature</th>
              <th className="border border-black p-1">Date</th>
            </tr></thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td className="border border-black p-1">{a.approver_name}</td>
                  <td className="border border-black p-1">{a.approval_level}</td>
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
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">7.0 Audit Trail Summary</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1">Action</th>
            <th className="border border-black p-1">User</th>
            <th className="border border-black p-1">Timestamp</th>
          </tr></thead>
          <tbody>
            {auditLogs.slice(0, 20).map((log, i) => (
              <tr key={i}>
                <td className="border border-black p-1">{String(log.action || '')}</td>
                <td className="border border-black p-1">{String(log.userName || '')}</td>
                <td className="border border-black p-1">{String(log.dateTime || log.timestamp || '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="text-[9px] text-center border-t border-black pt-2 mt-6">
        This document is electronically generated from Skymap QMS Change Control Module. Uncontrolled if printed.
      </footer>
    </article>
  );
}
