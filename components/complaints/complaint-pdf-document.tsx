'use client';

import type { ComplaintRecord, ComplaintInvestigation } from '@/lib/complaint-types';

export function ComplaintPdfDocument({ record, investigation, auditLogs }: {
  record: ComplaintRecord; investigation: ComplaintInvestigation | null; auditLogs: Record<string, unknown>[];
}) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  return (
    <article className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">SKYMAP<br />PHARMACEUTICALS PVT. LTD.</div>
          <div className="p-3 border-r border-black text-center"><p className="font-bold text-sm uppercase">Complaint Investigation Report</p><p className="text-[10px] mt-1">GMP Compliant</p></div>
          <div className="p-3 text-[10px]"><p><strong>Format:</strong> SOP/QA/CMP/F01-01</p><p><strong>Date:</strong> {fmt(record.created_at)}</p></div>
        </div>
        <div className="p-4 text-center bg-slate-50"><h1 className="text-lg font-bold uppercase">Market Complaint Report</h1><p className="font-mono font-bold text-sm mt-1">{record.complaint_number}</p></div>
      </header>
      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Complaint Details</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {[['Number', record.complaint_number], ['Date', fmt(record.complaint_date)], ['Customer', record.customer_name], ['Product', record.product_name], ['Batch', record.batch_number], ['Category', record.complaint_category], ['Criticality', record.complaint_criticality], ['Status', record.status]].map(([l, v]) => (
            <tr key={String(l)}><td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
          ))}
        </tbody></table>
        <p className="border border-black border-t-0 p-2"><strong>Description:</strong> {record.complaint_description}</p>
      </section>
      {investigation && (
        <section className="mb-4">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Investigation</h2>
          <p className="border border-black p-2"><strong>Summary:</strong> {investigation.investigation_summary}</p>
          <p className="border border-black border-t-0 p-2"><strong>Root Cause:</strong> {investigation.root_cause}</p>
          <p className="border border-black border-t-0 p-2"><strong>Conclusion:</strong> {investigation.conclusion}</p>
        </section>
      )}
      {record.linked_capa_number && <p className="border border-black p-2 mb-4"><strong>Linked CAPA:</strong> {record.linked_capa_number}</p>}
      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Audit Trail</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {auditLogs.slice(0, 15).map((log, i) => <tr key={i}><td className="border border-black p-1">{String(log.action)}</td><td className="border border-black p-1">{String(log.userName)}</td><td className="border border-black p-1">{String(log.dateTime)}</td></tr>)}
        </tbody></table>
      </section>
    </article>
  );
}
