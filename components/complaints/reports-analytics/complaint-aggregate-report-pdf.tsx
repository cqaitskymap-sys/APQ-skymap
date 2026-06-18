'use client';

import type { ComplaintReportFormData, ComplaintReportPreviewRow } from '@/lib/complaint-reports-records';
import type { ComplaintDashboardMetrics } from '@/lib/complaint-types';

interface ComplaintAggregateReportPdfProps {
  reportNumber: string;
  reportType: string;
  filters: ComplaintReportFormData;
  previewRows: ComplaintReportPreviewRow[];
  metrics: ComplaintDashboardMetrics & { customerResponsePending?: number };
  summary: string;
  managementSummary: string;
  investigationSummary: string;
  capaSummary: string;
  recallSummary: string;
  generatedBy: string;
  generatedDate: string;
}

export function ComplaintAggregateReportPdf({
  reportNumber,
  reportType,
  filters,
  previewRows,
  metrics,
  summary,
  managementSummary,
  investigationSummary,
  capaSummary,
  recallSummary,
  generatedBy,
  generatedDate,
}: ComplaintAggregateReportPdfProps) {
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const filterLine = [
    `Period: ${fmt(filters.review_period_from)} — ${fmt(filters.review_period_to)}`,
    filters.complaint_number ? `Complaint No: ${filters.complaint_number}` : null,
    `Product: ${filters.product || 'All'}`,
    filters.batch_number ? `Batch: ${filters.batch_number}` : null,
    `Market: ${filters.market_region || 'All'}`,
    filters.customer_name ? `Customer: ${filters.customer_name}` : null,
    `Category: ${filters.complaint_category || 'All'}`,
    `Criticality: ${filters.criticality || 'All'}`,
    `Status: ${filters.status || 'All'}`,
    `CAPA Required: ${filters.capa_required || 'All'}`,
    `Recall Required: ${filters.recall_required || 'All'}`,
  ].filter(Boolean).join(' | ');

  return (
    <article id="complaint-aggregate-report-pdf" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">GMP Market Complaint Report</p>
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
        <p className="border border-black p-2 mb-2 text-[10px]"><strong>Management Summary:</strong> {managementSummary}</p>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Total Complaints', metrics.total],
              ['Open', metrics.open],
              ['Closed', metrics.closed],
              ['Overdue', metrics.overdue],
              ['Critical', metrics.critical],
              ['CAPA Linked', metrics.capaLinked],
              ['Recall Evaluation', metrics.recallEvaluationRequired],
              ['Repeat Complaints', metrics.repeatComplaints],
              ['Avg Closure Days', metrics.avgClosureDays],
              ['Customer Response Pending', metrics.customerResponsePending ?? 0],
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
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Investigation Summary</h2>
        <p className="border border-black p-2 text-[10px]">{investigationSummary}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">CAPA Summary</h2>
        <p className="border border-black p-2 text-[10px]">{capaSummary}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Recall Summary</h2>
        <p className="border border-black p-2 text-[10px]">{recallSummary}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Complaint Register</h2>
        <table className="w-full border border-black text-[9px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1">Complaint No</th>
              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1">Customer</th>
              <th className="border border-black p-1">Product</th>
              <th className="border border-black p-1">Criticality</th>
              <th className="border border-black p-1">Status</th>
              <th className="border border-black p-1">CAPA</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.slice(0, 50).map((row) => (
              <tr key={row.complaint_number}>
                <td className="border border-black p-1 font-mono">{row.complaint_number}</td>
                <td className="border border-black p-1">{fmt(row.complaint_date)}</td>
                <td className="border border-black p-1">{row.customer_name}</td>
                <td className="border border-black p-1">{row.product_name}</td>
                <td className="border border-black p-1">{row.complaint_criticality}</td>
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
          Monthly complaint trend, product-wise, market-wise, category, criticality, status, CAPA linkage,
          recall evaluation, and closure performance charts are rendered in the interactive analytics workspace.
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
