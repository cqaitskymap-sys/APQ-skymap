'use client';

import type { RecallRecord, RecallDistribution, RecallRecovery } from '@/lib/recall-types';

export function RecallPdfDocument({ record, distributions, recoveries, auditLogs }: {
  record: RecallRecord; distributions: RecallDistribution[]; recoveries: RecallRecovery[]; auditLogs: Record<string, unknown>[];
}) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const isMock = record.recall_type === 'Mock Recall' || record.recall_classification === 'Mock';
  return (
    <article className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">SKYMAP<br />PHARMACEUTICALS PVT. LTD.</div>
          <div className="p-3 border-r border-black text-center"><p className="font-bold text-sm uppercase">{isMock ? 'Mock Recall Report' : 'Product Recall Report'}</p><p className="text-[10px] mt-1">GMP Compliant</p></div>
          <div className="p-3 text-[10px]"><p><strong>Format:</strong> SOP/QA/RCL/F01-01</p><p><strong>Date:</strong> {fmt(record.created_at)}</p></div>
        </div>
        <div className="p-4 text-center bg-slate-50"><h1 className="text-lg font-bold uppercase">{isMock ? 'Mock Recall Report' : 'Product Recall Report'}</h1><p className="font-mono font-bold text-sm mt-1">{record.recall_number}</p></div>
      </header>
      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Recall Details</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {[['Number', record.recall_number], ['Date', fmt(record.recall_date)], ['Type', record.recall_type], ['Classification', record.recall_classification], ['Product', record.product_name], ['Batch', record.batch_number], ['Recovery %', `${record.recovery_percent}%`], ['Status', record.recall_status]].map(([l, v]) => (
            <tr key={String(l)}><td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
          ))}
        </tbody></table>
        <p className="border border-black border-t-0 p-2"><strong>Reason:</strong> {record.reason_for_recall}</p>
      </section>
      {distributions.length > 0 && (
        <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Distribution</h2>
          <table className="w-full border border-black text-[10px]"><thead><tr className="bg-slate-100"><th className="border border-black p-1">Customer</th><th className="border border-black p-1">Qty</th><th className="border border-black p-1">Date</th></tr></thead><tbody>
            {distributions.map((d) => <tr key={d.id}><td className="border border-black p-1">{d.customer_name}</td><td className="border border-black p-1">{d.quantity_distributed}</td><td className="border border-black p-1">{fmt(d.distribution_date)}</td></tr>)}
          </tbody></table></section>
      )}
      {recoveries.length > 0 && (
        <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Recovery</h2>
          <table className="w-full border border-black text-[10px]"><thead><tr className="bg-slate-100"><th className="border border-black p-1">From</th><th className="border border-black p-1">Qty</th><th className="border border-black p-1">Date</th></tr></thead><tbody>
            {recoveries.map((r) => <tr key={r.id}><td className="border border-black p-1">{r.recovered_from}</td><td className="border border-black p-1">{r.quantity_recovered}</td><td className="border border-black p-1">{fmt(r.recovery_date)}</td></tr>)}
          </tbody></table></section>
      )}
      <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Conclusion</h2>
        <p className="border border-black p-3">{isMock ? 'Mock recall exercise completed per SOP. Recovery effectiveness verified.' : `Recall ${record.recall_status}. Recovery achieved: ${record.recovery_percent}%.`}</p>
      </section>
      <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Audit Trail</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {auditLogs.slice(0, 15).map((log, i) => <tr key={i}><td className="border border-black p-1">{String(log.action)}</td><td className="border border-black p-1">{String(log.userName)}</td><td className="border border-black p-1">{String(log.dateTime)}</td></tr>)}
        </tbody></table></section>
    </article>
  );
}
