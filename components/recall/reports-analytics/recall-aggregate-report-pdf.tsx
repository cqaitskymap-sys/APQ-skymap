'use client';

import type { RecallReportFormData } from '@/lib/recall-reports-records';
import type {
  RecallManagementReviewSummary,
  RecallReportAnalyticsMetrics,
  RecallReportPreviewRow,
} from '@/lib/recall-types';

interface RecallAggregateReportPdfProps {
  reportNumber: string;
  reportType: string;
  filters: RecallReportFormData;
  previewRows: RecallReportPreviewRow[];
  metrics: RecallReportAnalyticsMetrics;
  summary: string;
  recommendations: string;
  managementReview: RecallManagementReviewSummary;
  distributionSummary: Record<string, unknown>;
  recoverySummary: Record<string, unknown>;
  regulatorySummary: Record<string, unknown>;
  capaSummary: Record<string, unknown>;
  generatedBy: string;
  generatedDate: string;
}

export function RecallAggregateReportPdf({
  reportNumber,
  reportType,
  filters,
  previewRows,
  metrics,
  summary,
  recommendations,
  managementReview,
  distributionSummary,
  recoverySummary,
  regulatorySummary,
  capaSummary,
  generatedBy,
  generatedDate,
}: RecallAggregateReportPdfProps) {
  const fmt = (d?: string) => (d && d !== '—' ? new Date(d).toLocaleDateString('en-GB') : '—');
  const filterLine = [
    `Period: ${fmt(filters.review_period_from)} — ${fmt(filters.review_period_to)}`,
    filters.recall_number ? `Recall No: ${filters.recall_number}` : '',
    `Product: ${filters.product || 'All'}`,
    filters.batch_number ? `Batch: ${filters.batch_number}` : '',
    `Market: ${filters.market_region || 'All'}`,
    `Type: ${filters.recall_type || 'All'}`,
    `Classification: ${filters.recall_classification || 'All'}`,
    `Status: ${filters.status || 'All'}`,
    `Regulatory Ntf: ${filters.regulatory_notification_required || 'All'}`,
    `CAPA Required: ${filters.capa_required || 'All'}`,
  ].filter(Boolean).join(' | ');

  return (
    <article id="recall-aggregate-report-pdf" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">GMP Product Recall Report</p>
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
          <p className="text-[10px] mt-1">Report Period: {fmt(filters.review_period_from)} — {fmt(filters.review_period_to)}</p>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Filter Criteria</h2>
        <p className="border border-black p-2 text-[10px]">{filterLine}</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Management Summary</h2>
        <p className="border border-black p-2 mb-2">{managementReview.narrative}</p>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Total Recalls', metrics.total],
              ['Open Recalls', metrics.open],
              ['Closed Recalls', metrics.closed],
              ['Class I Recalls', metrics.classI],
              ['Avg Recovery %', `${metrics.avgRecoveryPercent}%`],
              ['CAPA Linked', metrics.capaLinked],
              ['Avg Closure Days', metrics.avgClosureDays],
              ['Overdue Recalls', metrics.overdue],
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
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Distribution Summary</h2>
        <p className="border border-black p-2 text-[10px]">
          Lines: {String(distributionSummary.total_lines ?? 0)} | Qty Distributed: {String(distributionSummary.total_quantity_distributed ?? 0)} | Customers: {String(distributionSummary.unique_customers ?? 0)} | Markets: {String(distributionSummary.unique_markets ?? 0)}
        </p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Recovery Summary</h2>
        <p className="border border-black p-2 text-[10px]">
          Entries: {String(recoverySummary.total_recovery_entries ?? 0)} | Distributed: {String(recoverySummary.total_distributed ?? 0)} | Recovered: {String(recoverySummary.total_recovered ?? 0)} | Pending: {String(recoverySummary.total_pending ?? 0)} | Avg Recovery: {String(recoverySummary.average_recovery_percent ?? 0)}%
        </p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Regulatory Notification Summary</h2>
        <p className="border border-black p-2 text-[10px]">
          Total: {String(regulatorySummary.total_notifications ?? 0)} | Pending: {String(regulatorySummary.pending ?? 0)} | Submitted: {String(regulatorySummary.submitted ?? 0)}
        </p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">CAPA Summary</h2>
        <p className="border border-black p-2 text-[10px]">
          CAPA Linked: {String(capaSummary.capa_linked_count ?? 0)} | CAPA Required: {String(capaSummary.capa_required_count ?? 0)}
        </p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Trend Analysis</h2>
        <p className="border border-black p-2">{summary}</p>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Recall Data Table</h2>
        {previewRows.length === 0 ? (
          <p className="border border-black p-4 text-center text-muted-foreground">No recall records match the selected filters.</p>
        ) : (
          <table className="w-full border border-black text-[9px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-black p-1">Recall No</th>
                <th className="border border-black p-1">Date</th>
                <th className="border border-black p-1">Product</th>
                <th className="border border-black p-1">Batch</th>
                <th className="border border-black p-1">Market</th>
                <th className="border border-black p-1">Class</th>
                <th className="border border-black p-1">Status</th>
                <th className="border border-black p-1">Recovery</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(0, 40).map((row) => (
                <tr key={row.recall_number}>
                  <td className="border border-black p-1 font-mono">{row.recall_number}</td>
                  <td className="border border-black p-1">{row.recall_date}</td>
                  <td className="border border-black p-1">{row.product_name}</td>
                  <td className="border border-black p-1">{row.batch_number}</td>
                  <td className="border border-black p-1">{row.market_region}</td>
                  <td className="border border-black p-1">{row.recall_classification}</td>
                  <td className="border border-black p-1">{row.recall_status}</td>
                  <td className="border border-black p-1">{row.recovery_percent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Charts Placeholder</h2>
        <div className="border border-dashed border-black p-6 text-center text-[10px] text-slate-600">
          Monthly Recall Trend | Recall by Product | Recall by Market | Classification | Recovery | Regulatory | CAPA Linkage | Closure Performance
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Recommendations</h2>
        <p className="border border-black p-2 whitespace-pre-line">{recommendations}</p>
      </section>

      <footer className="border-t-2 border-black pt-2 text-[9px] flex justify-between">
        <span>Generated by: {generatedBy}</span>
        <span>Generated date: {fmt(generatedDate)}</span>
        <span>Page 1 of 2 — Confidential</span>
      </footer>
    </article>
  );
}
