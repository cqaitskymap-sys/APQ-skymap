'use client';

import type { CcReportFormData } from '@/lib/cc-reports-records';
import type { CcManagementReviewSummary, CcReportAnalyticsMetrics, CcReportPreviewRow } from '@/lib/change-control-types';

interface CcAggregateReportPdfProps {
  reportNumber: string;
  reportType: string;
  filters: CcReportFormData;
  previewRows: CcReportPreviewRow[];
  metrics: CcReportAnalyticsMetrics;
  summary: string;
  recommendations: string;
  managementReview: CcManagementReviewSummary;
  generatedBy: string;
  generatedDate: string;
}

export function CcAggregateReportPdf({
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
}: CcAggregateReportPdfProps) {
  const fmt = (d?: string) => (d && d !== '—' ? new Date(d).toLocaleDateString('en-GB') : '—');
  const filterLine = [
    `Period: ${fmt(filters.review_period_from)} — ${fmt(filters.review_period_to)}`,
    `Department: ${filters.department || 'All'}`,
    `Product: ${filters.product || 'All'}`,
    `Change Type: ${filters.change_type || 'All'}`,
    `Category: ${filters.category || 'All'}`,
    `Priority: ${filters.priority || 'All'}`,
    `Status: ${filters.status || 'All'}`,
    filters.validation_impact ? 'Validation Impact' : '',
    filters.csv_impact ? 'CSV Impact' : '',
    filters.training_impact ? 'Training Impact' : '',
    filters.regulatory_impact ? 'Regulatory Impact' : '',
  ].filter(Boolean).join(' | ');

  return (
    <article id="cc-aggregate-report-pdf" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">GMP Change Control Report</p>
            <p className="text-[10px] mt-1">GAMP5 | Annex 11 | Quality Management System</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Report No.:</strong> {reportNumber}</p>
            <p><strong>Generated:</strong> {fmt(generatedDate)}</p>
            <p><strong>Prepared By:</strong> {generatedBy}</p>
            <p><strong>Approved By:</strong> _________________</p>
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
              ['Total Changes Initiated', managementReview.totalChangesInitiated],
              ['Total Changes Closed', managementReview.totalChangesClosed],
              ['Overdue Change %', `${managementReview.overdueChangePct}%`],
              ['Validation Impact %', `${managementReview.validationImpactPct}%`],
              ['CSV Impact %', `${managementReview.csvImpactPct}%`],
              ['Training Impact %', `${managementReview.trainingImpactPct}%`],
              ['Critical Changes', managementReview.criticalChanges],
              ['Closure Rate', `${metrics.closureRate}%`],
              ['Implementation Success', `${metrics.implementationSuccessRate}%`],
            ].map(([label, val]) => (
              <tr key={String(label)} className="border-b border-black">
                <td className="p-1 font-medium w-1/2">{label}</td>
                <td className="p-1">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Change Data Table</h2>
        {previewRows.length ? (
          <table className="w-full border border-black text-[9px]">
            <thead>
              <tr className="bg-slate-100">
                {['Change No', 'Title', 'Type', 'Dept', 'Status', 'Priority', 'Validation'].map((h) => (
                  <th key={h} className="border border-black p-1 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(0, 25).map((r) => (
                <tr key={r.change_number}>
                  <td className="border border-black p-1">{r.change_number}</td>
                  <td className="border border-black p-1">{r.title}</td>
                  <td className="border border-black p-1">{r.change_type}</td>
                  <td className="border border-black p-1">{r.department}</td>
                  <td className="border border-black p-1">{r.status}</td>
                  <td className="border border-black p-1">{r.priority}</td>
                  <td className="border border-black p-1">{r.validation_impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="border border-black p-4 text-center text-muted-foreground">No records match the selected filters.</p>
        )}
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">Management Recommendations</h2>
        <p className="border border-black p-2 whitespace-pre-wrap text-[10px]">{recommendations}</p>
      </section>

      <footer className="text-[10px] text-center border-t border-black pt-2 mt-4">
        <p>{summary}</p>
        <p className="mt-1">Immutable audit trail maintained. Generated: {new Date().toLocaleString()}</p>
      </footer>
    </article>
  );
}
