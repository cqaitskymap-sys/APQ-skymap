'use client';

import type { AnnualCpvDocument } from '@/lib/cpv-annual-review';
import { workflowStatusLabel } from '@/lib/cpv-annual-review';

interface Props {
  document: AnnualCpvDocument;
}

export function AnnualCpvPdfDocument({ document: doc }: Props) {
  const snap = doc.snapshot;
  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

  const sectionHeader = (num: string, title: string) => (
    <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">
      {num} {title}
    </h2>
  );

  const tableCell = 'border border-black p-1.5';

  return (
    <article
      id="annual-cpv-pdf-document"
      className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6"
    >
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black flex items-center justify-center">
            <div className="text-center font-bold text-blue-800 text-sm">SKYMAP<br />PHARMACEUTICALS</div>
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">Skymap Pharmaceuticals Pvt. Ltd.</p>
            <p className="text-[10px] mt-1">Continued Process Verification</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Format No.:</strong> SOP/QA/CPV/F01</p>
            <p><strong>Rev. No.:</strong> 01</p>
            <p><strong>Status:</strong> {workflowStatusLabel(doc.status)}</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase tracking-wide">Annual Continued Process Verification Report</h1>
          <p className="text-sm font-semibold mt-2">Review Year: {doc.reviewYear}</p>
          <p className="text-xs mt-1">Document No.: <span className="font-mono font-bold">{doc.documentNumber}</span></p>
          <p className="text-xs mt-1">Product Scope: {doc.productName}</p>
          <p className="text-xs mt-1">Generated: {formatDate(snap.generatedAt)}</p>
        </div>
      </header>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('1.0', 'Executive Summary')}
        <p className="border border-black p-2 text-justify min-h-[80px]">{snap.executiveSummary}</p>
        <table className="w-full border border-black text-[10px] mt-2">
          <tbody>
            <tr>
              <td className={`${tableCell} font-semibold bg-slate-50 w-1/4`}>CPP Observations</td>
              <td className={tableCell}>{snap.cpp.total}</td>
              <td className={`${tableCell} font-semibold bg-slate-50 w-1/4`}>CQA Results</td>
              <td className={tableCell}>{snap.cqa.total}</td>
            </tr>
            <tr>
              <td className={`${tableCell} font-semibold bg-slate-50`}>Average Cpk</td>
              <td className={tableCell}>{snap.capability.averageCpk.toFixed(2)}</td>
              <td className={`${tableCell} font-semibold bg-slate-50`}>OOT / OOS</td>
              <td className={tableCell}>{snap.trend.oot} / {snap.trend.oos}</td>
            </tr>
            <tr>
              <td className={`${tableCell} font-semibold bg-slate-50`}>Deviations</td>
              <td className={tableCell}>{snap.deviations.total}</td>
              <td className={`${tableCell} font-semibold bg-slate-50`}>OOS Investigations</td>
              <td className={tableCell}>{snap.oos.total}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('2.0', 'CPP Review')}
        <p className="border border-black p-2 mb-2">{snap.cpp.summary}</p>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className={tableCell}>Total</th>
            <th className={tableCell}>Pass</th>
            <th className={tableCell}>OOT</th>
            <th className={tableCell}>OOS</th>
          </tr></thead>
          <tbody><tr>
            <td className={`${tableCell} text-center font-bold`}>{snap.cpp.total}</td>
            <td className={`${tableCell} text-center`}>{snap.cpp.complies ?? 0}</td>
            <td className={`${tableCell} text-center`}>{snap.cpp.oot ?? 0}</td>
            <td className={`${tableCell} text-center`}>{snap.cpp.oos ?? 0}</td>
          </tr></tbody>
        </table>
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('3.0', 'CQA Review')}
        <p className="border border-black p-2 mb-2">{snap.cqa.summary}</p>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className={tableCell}>Total</th>
            <th className={tableCell}>Pass</th>
            <th className={tableCell}>OOT</th>
            <th className={tableCell}>OOS</th>
          </tr></thead>
          <tbody><tr>
            <td className={`${tableCell} text-center font-bold`}>{snap.cqa.total}</td>
            <td className={`${tableCell} text-center`}>{snap.cqa.complies ?? 0}</td>
            <td className={`${tableCell} text-center`}>{snap.cqa.oot ?? 0}</td>
            <td className={`${tableCell} text-center`}>{snap.cqa.oos ?? 0}</td>
          </tr></tbody>
        </table>
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('4.0', 'Capability Review')}
        <p className="border border-black p-2 mb-2">{snap.capability.summary}</p>
        <p className="text-[10px] mb-1">Control chart special-cause signals: <strong>{snap.capability.controlViolations}</strong></p>
        {snap.capability.items.length > 0 && (
          <table className="w-full border border-black text-[10px]">
            <thead><tr className="bg-slate-100">
              <th className={tableCell}>Source</th>
              <th className={tableCell}>Parameter</th>
              <th className={tableCell}>n</th>
              <th className={tableCell}>Cpk</th>
              <th className={tableCell}>Ppk</th>
              <th className={tableCell}>Status</th>
            </tr></thead>
            <tbody>
              {snap.capability.items.map((item) => (
                <tr key={`${item.source}-${item.parameter}`}>
                  <td className={tableCell}>{item.source}</td>
                  <td className={tableCell}>{item.parameter}</td>
                  <td className={`${tableCell} text-center`}>{item.count}</td>
                  <td className={`${tableCell} text-center`}>{item.cpk}</td>
                  <td className={`${tableCell} text-center`}>{item.ppk}</td>
                  <td className={tableCell}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('5.0', 'Trend Analysis')}
        <p className="border border-black p-2">{snap.trend.summary}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('6.0', 'Risk Assessment')}
        <p className="border border-black p-2 mb-2">{snap.risk.summary}</p>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            {['Total', 'Critical', 'High', 'Medium', 'Low'].map((h) => (
              <th key={h} className={tableCell}>{h}</th>
            ))}
          </tr></thead>
          <tbody><tr>
            {[snap.risk.total, snap.risk.critical, snap.risk.high, snap.risk.medium, snap.risk.low].map((v, i) => (
              <td key={i} className={`${tableCell} text-center font-bold`}>{v}</td>
            ))}
          </tr></tbody>
        </table>
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('7.0', 'Integrated Quality System & Batch Data')}
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className={tableCell}>Module</th>
            <th className={tableCell}>Total</th>
            <th className={tableCell}>Open</th>
            <th className={tableCell}>Summary</th>
          </tr></thead>
          <tbody>
            {[
              { label: 'Deviations', data: snap.deviations },
              { label: 'OOS Investigations', data: snap.oos },
              { label: 'CAPA', data: snap.capa },
              { label: 'Change Control', data: snap.changeControl },
              { label: 'Batch Data', data: { total: snap.batches.total, open: 0, summary: snap.batches.summary } },
              { label: 'Equipment Qualification', data: snap.equipment },
            ].map((row) => (
              <tr key={row.label}>
                <td className={`${tableCell} font-semibold`}>{row.label}</td>
                <td className={`${tableCell} text-center`}>{row.data.total}</td>
                <td className={`${tableCell} text-center`}>{row.data.open ?? '—'}</td>
                <td className={tableCell}>{row.data.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {snap.batches.records.length > 0 && (
          <table className="w-full border border-black text-[10px] mt-2">
            <thead><tr className="bg-slate-100">
              <th className={tableCell}>Batch No.</th>
              <th className={tableCell}>Product</th>
              <th className={tableCell}>Status</th>
            </tr></thead>
            <tbody>
              {snap.batches.records.slice(0, 10).map((b, i) => (
                <tr key={i}>
                  <td className={`${tableCell} font-mono`}>{String(b.batch_number || b.batchNo || '—')}</td>
                  <td className={tableCell}>{String(b.product_name || b.productName || '—')}</td>
                  <td className={tableCell}>{String(b.status || b.batch_status || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('8.0', 'Conclusion')}
        <p className="border border-black p-2 min-h-[80px] text-justify">{doc.conclusion || snap.conclusion}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        {sectionHeader('9.0', 'Recommendations')}
        <p className="border border-black p-2 min-h-[80px] text-justify whitespace-pre-wrap">
          {doc.recommendations || snap.recommendations}
        </p>
      </section>

      <section className="print-break break-inside-avoid">
        {sectionHeader('10.0', 'Electronic Signatures & Approval')}
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className={tableCell}>Role</th>
            <th className={tableCell}>Designation</th>
            <th className={tableCell}>Name</th>
            <th className={tableCell}>E-Signature</th>
            <th className={tableCell}>Date</th>
            <th className={tableCell}>Meaning</th>
          </tr></thead>
          <tbody>
            {(doc.signatures || []).map((sig, i) => (
              <tr key={i}>
                <td className={`${tableCell} capitalize`}>{sig.role}</td>
                <td className={tableCell}>{sig.designation}</td>
                <td className={tableCell}>{sig.name || '—'}</td>
                <td className={`${tableCell} italic font-serif`}>
                  {sig.signatureText || (sig.signedAt ? 'Signed electronically' : 'Pending')}
                </td>
                <td className={tableCell}>{formatDate(sig.signedAt)}</td>
                <td className={tableCell}>{sig.meaning || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[9px] mt-3 text-center text-gray-600">
          This document is controlled. Uncontrolled when printed. 21 CFR Part 11 compliant e-signatures.
          Document Status: {workflowStatusLabel(doc.status).toUpperCase()}
        </p>
      </section>
    </article>
  );
}
