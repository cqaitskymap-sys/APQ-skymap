'use client';

import type { DeviationReportFormData, ReportPreviewRow } from '@/lib/deviation-reports-records';
import type { DeviationDashboardMetrics } from '@/lib/deviation-types';

interface DeviationAggregateReportPdfProps {
  reportNumber: string;
  reportType: string;
  filters: DeviationReportFormData;
  previewRows: ReportPreviewRow[];
  metrics: DeviationDashboardMetrics;
  summary: string;
  generatedBy: string;
  generatedDate: string;
}

export function DeviationAggregateReportPdf({
  reportNumber,
  reportType,
  filters,
  previewRows,
  metrics,
  summary,
  generatedBy,
  generatedDate,
}: DeviationAggregateReportPdfProps) {
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const filterLine = [
    `Period: ${fmt(filters.review_period_from)} — ${fmt(filters.review_period_to)}`,
    `Department: ${filters.department || 'All'}`,
    `Product: ${filters.product || 'All'}`,
    `Criticality: ${filters.criticality || 'All'}`,
    `Status: ${filters.status || 'All'}`,
  ].join(' | ');

  return (
    <article id="deviation-aggregate-report-pdf" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">GMP Deviation Report</p>
            <p className="text-[10px] mt-1">21 CFR Part 11 | Quality Management System</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Report No.:</strong> {reportNumber}</p>
            <p><strong>Generated:</strong> {fmt(generatedDate)}</p>
            <p><strong>Page:</strong> 1 of 1</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase">{reportType}</h1>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Filter Criteria</h2>
        <p className="border border-black p-2 text-[10px]">{filterLine}</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Executive Summary</h2>
        <p className="border border-black p-2 mb-2">{summary}</p>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Total Deviations', metrics.total],
              ['Open', metrics.open],
              ['Closed', metrics.closed],
              ['Overdue', metrics.overdue],
              ['Critical', metrics.critical],
              ['Repeat', metrics.repeat],
              ['CAPA Linked', metrics.capaLinked],
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

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Deviation Register</h2>
        <table className="w-full border border-black text-[9px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1">Deviation No</th>
              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">Dept</th>
              <th className="border border-black p-1">Product</th>
              <th className="border border-black p-1">Criticality</th>
              <th className="border border-black p-1">Status</th>
              <th className="border border-black p-1">CAPA</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.slice(0, 50).map((row) => (
              <tr key={row.deviation_number}>
                <td className="border border-black p-1 font-mono">{row.deviation_number}</td>
                <td className="border border-black p-1">{fmt(row.deviation_date)}</td>
                <td className="border border-black p-1">{row.department}</td>
                <td className="border border-black p-1">{row.product_name}</td>
                <td className="border border-black p-1">{row.criticality}</td>
                <td className="border border-black p-1">{row.status}</td>
                <td className="border border-black p-1">{row.capa_linked}</td>
              </tr>
            ))}
            {!previewRows.length && (
              <tr><td colSpan={7} className="border border-black p-2 text-center">No records for selected criteria</td></tr>
            )}
          </tbody>
        </table>
        {previewRows.length > 50 && (
          <p className="text-[9px] mt-1 italic">Showing first 50 of {previewRows.length} records.</p>
        )}
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Analytics Charts (Placeholder)</h2>
        <div className="border border-dashed border-black p-6 text-center text-[10px] text-slate-600">
          Monthly trend, department-wise, category, criticality, status, CAPA linkage, and closure performance charts
          are rendered in the interactive analytics workspace. Export to PDF with embedded charts is a planned enhancement.
        </div>
      </section>

      <footer className="mt-6 border-t border-black pt-3 text-[9px]">
        <p><strong>Generated By:</strong> {generatedBy}</p>
        <p><strong>Generated Date:</strong> {fmt(generatedDate)}</p>
        <p className="text-center mt-2">This document is electronically generated and controlled. Unauthorized reproduction is prohibited.</p>
        <p className="text-center">Skymap Pharmaceuticals Pvt. Ltd. | Odisha, India</p>
      </footer>
    </article>
  );
}
