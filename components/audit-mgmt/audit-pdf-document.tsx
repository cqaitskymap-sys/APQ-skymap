'use client';

import type {
  AuditRecord, AuditChecklistItem, AuditFinding, AuditCapaLink, AuditApproval,
} from '@/lib/audit-mgmt-types';

export function AuditPdfDocument({ record, checklist, findings, capaLinks, approvals }: {
  record: AuditRecord;
  checklist: AuditChecklistItem[];
  findings: AuditFinding[];
  capaLinks: AuditCapaLink[];
  approvals: AuditApproval[];
}) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  return (
    <article className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">SKYMAP<br />PHARMACEUTICALS PVT. LTD.</div>
          <div className="p-3 border-r border-black text-center"><p className="font-bold text-sm uppercase">Complete Audit Report</p><p className="text-[10px] mt-1">GMP Compliant</p></div>
          <div className="p-3 text-[10px]"><p><strong>Format:</strong> SOP/QA/AUD/F01-01</p><p><strong>Date:</strong> {fmt(record.audit_date)}</p></div>
        </div>
        <div className="p-4 text-center bg-slate-50"><h1 className="text-lg font-bold uppercase">{record.audit_title}</h1><p className="font-mono font-bold text-sm mt-1">{record.audit_number}</p></div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Audit Details</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {[['Type', record.audit_type], ['Department', record.department], ['Date', fmt(record.audit_date)],
            ['Lead Auditor', record.lead_auditor_name], ['Auditee', record.auditee], ['Status', record.status]].map(([l, v]) => (
            <tr key={String(l)}><td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
          ))}
        </tbody></table>
        <p className="border border-black border-t-0 p-2"><strong>Scope:</strong> {record.audit_scope}</p>
        <p className="border border-black border-t-0 p-2"><strong>Criteria:</strong> {record.audit_criteria}</p>
      </section>

      {checklist.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Checklist</h2>
          <table className="w-full border border-black text-[9px]"><thead><tr className="bg-slate-100">
            <th className="border border-black p-1">#</th><th className="border border-black p-1">Area</th>
            <th className="border border-black p-1">Question</th><th className="border border-black p-1">Status</th>
          </tr></thead><tbody>
            {checklist.map((c) => (
              <tr key={c.id}><td className="border border-black p-1">{c.checklist_number}</td>
                <td className="border border-black p-1">{c.audit_area}</td>
                <td className="border border-black p-1">{c.checklist_question}</td>
                <td className="border border-black p-1">{c.compliance_status}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {findings.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Findings & Risk Assessment</h2>
          <table className="w-full border border-black text-[9px]"><thead><tr className="bg-slate-100">
            <th className="border border-black p-1">Number</th><th className="border border-black p-1">Type</th>
            <th className="border border-black p-1">RPN</th><th className="border border-black p-1">Risk</th>
            <th className="border border-black p-1">Observation</th>
          </tr></thead><tbody>
            {findings.map((f) => (
              <tr key={f.id}><td className="border border-black p-1">{f.finding_number}</td>
                <td className="border border-black p-1">{f.finding_type}</td>
                <td className="border border-black p-1">{f.rpn}</td>
                <td className="border border-black p-1">{f.risk_level}</td>
                <td className="border border-black p-1">{f.observation}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {capaLinks.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 CAPA Links</h2>
          {capaLinks.map((l) => <p key={l.id} className="border border-black p-2 border-t-0 first:border-t">{l.capa_number}</p>)}
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Conclusion & Approval</h2>
        <p className="border border-black p-2">Total Findings: {record.total_findings} | Critical: {record.critical_findings} | CAPA Required: {record.capa_required_count}</p>
        {approvals.map((a) => (
          <p key={a.id} className="border border-black border-t-0 p-2">
            <strong>{a.approver_name}</strong> — {a.decision} ({fmt(a.signed_at)})<br />{a.comments}
          </p>
        ))}
        <div className="grid grid-cols-2 gap-4 mt-4 border border-black p-4">
          <div><p className="border-b border-black pb-8">Lead Auditor Signature</p><p className="text-[9px] mt-1">{record.lead_auditor_name}</p></div>
          <div><p className="border-b border-black pb-8">Head QA Approval</p><p className="text-[9px] mt-1">Date: ___________</p></div>
        </div>
      </section>
    </article>
  );
}
