'use client';

import type { CapaReportFormData } from '@/lib/capa-reports-records';
import type { CapaManagementReviewSummary, CapaReportAnalyticsMetrics, CapaReportPreviewRow } from '@/lib/capa-types';

interface CapaAggregateReportPdfProps {
  reportNumber: string;
  reportType: string;
  filters: CapaReportFormData;
  previewRows: CapaReportPreviewRow[];
  metrics: CapaReportAnalyticsMetrics;
  summary: string;
  recommendations: string;
  managementReview: CapaManagementReviewSummary;
  generatedBy: string;
  generatedDate: string;
}

export function CapaAggregateReportPdf({
  reportNumber,
  reportType,
  filters,
  previewRows,
  metrics,
  summary,
  recommendations,
  managementReview,
  generatedBy,
  generatedDate,
}: CapaAggregateReportPdfProps) {
  const fmt = (d?: string) => (d && d !== '—' ? new Date(d).toLocaleDateString('en-GB') : '—');
  const filterLine = [
    `Period: ${fmt(filters.review_period_from)} — ${fmt(filters.review_period_to)}`,
    `Department: ${filters.department || 'All'}`,
    `Product: ${filters.product || 'All'}`,
    `Source: ${filters.capa_source || 'All'}`,
    `Priority: ${filters.priority || 'All'}`,
    `Status: ${filters.status || 'All'}`,
    `Effectiveness: ${filters.effectiveness_result || 'All'}`,
    filters.overdue_only ? 'Overdue Only' : '',
    filters.critical_only ? 'Critical Only' : '',
  ].filter(Boolean).join(' | ');

  return (
    <article id="capa-aggregate-report-pdf" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">GMP CAPA Report</p>
            <p className="text-[10px] mt-1">21 CFR Part 11 | Quality Management System</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Report No.:</strong> {reportNumber}</p>
            <p><strong>Generated:</strong> {fmt(generatedDate)}</p>
            <p><strong>Prepared By:</strong> {generatedBy}</p>
            <p><strong>Page:</strong> 1 of 2</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase">{reportType}</h1>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Filter Summary</h2>
        <p className="border border-black p-2 text-[10px]">{filterLine}</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Management Summary</h2>
        <p className="border border-black p-2 mb-2">{managementReview.narrative}</p>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Total CAPA Created', managementReview.totalCapaCreated],
              ['Total CAPA Closed', managementReview.totalCapaClosed],
              ['Overdue CAPA %', `${managementReview.overdueCapaPct}%`],
              ['CAPA Effectiveness %', `${managementReview.capaEffectivenessPct}%`],
              ['CAPA Success Rate', `${metrics.capaSuccessRate}%`],
              ['Avg Closure Days', metrics.avgClosureDays],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td className="border border-black p-1.5 w-1/2 font-semibold bg-slate-50">{label}</td>
                <td className="border border-black p-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Trend Analysis</h2>
        <p className="border border-black p-2">{summary}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">CAPA Data Table</h2>
        <table className="w-full border border-black text-[9px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1">CAPA No</th>
              <th className="border border-black p-1">Source</th>
              <th className="border border-black p-1">Dept</th>
              <th className="border border-black p-1">Product</th>
              <th className="border border-black p-1">Priority</th>
              <th className="border border-black p-1">Status</th>
              <th className="border border-black p-1">Effectiveness</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.slice(0, 40).map((row) => (
              <tr key={row.capa_number}>
                <td className="border border-black p-1 font-mono">{row.capa_number}</td>
                <td className="border border-black p-1">{row.capa_source}</td>
                <td className="border border-black p-1">{row.department}</td>
                <td className="border border-black p-1">{row.product}</td>
                <td className="border border-black p-1">{row.priority}</td>
                <td className="border border-black p-1">{row.status}</td>
                <td className="border border-black p-1">{row.effectiveness_result}</td>
              </tr>
            ))}
            {!previewRows.length && (
              <tr><td colSpan={7} className="border border-black p-2 text-center">No records for selected criteria</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-4 border border-dashed border-black p-3 text-center">
        <p className="font-semibold">Charts Section</p>
        <p className="text-[10px]">Monthly Trend · Source · Department · Priority · Status · Effectiveness · Closure · Overdue · Root Cause · Risk</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Recommendations</h2>
        <pre className="border border-black p-2 whitespace-pre-wrap font-sans text-[10px]">{recommendations}</pre>
      </section>

      <footer className="border-t border-black pt-4 grid grid-cols--2 gap-8 text-[10px]">
        <div>
          <p className="font-semibold mb-6">Prepared By</p>
          <p>{generatedBy}</p>
          <p className="text-muted-foreground">Date: {fmt(generatedDate)}</p>
        </div>
        <div>
          <p className="font-semibold mb-6">Approved By</p>
          <p className="border-b border-black pb-1">Head QA / Authorized Signatory</p>
        </div>
      </footer>

      <p className="text-[9px] text-center mt-4">Confidential — GMP Quality Record · {reportNumber} · Page 2 of 2</p>
    </article>
  );
}
