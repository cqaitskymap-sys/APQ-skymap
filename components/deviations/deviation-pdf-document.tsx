'use client';

import type {
  DeviationRecord, DeviationInvestigation, DeviationImpactAssessment,
  DeviationApproval, DeviationAttachment,
} from '@/lib/deviation-types';
import { DeviationStatusBadge, DeviationCriticalityBadge } from './deviation-sub-nav';

interface DeviationPdfDocumentProps {
  record: DeviationRecord;
  investigation: DeviationInvestigation | null;
  impact: DeviationImpactAssessment | null;
  approvals: DeviationApproval[];
  auditLogs: Record<string, unknown>[];
}

export function DeviationPdfDocument({
  record, investigation, impact, approvals, auditLogs,
}: DeviationPdfDocumentProps) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const yn = (v: boolean) => v ? 'Yes' : 'No';

  return (
    <article id="deviation-pdf-document" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">
            SKYMAP<br />PHARMACEUTICALS PVT. LTD.
          </div>
          <div className="p-3 border-r border-black text-center">
            <p className="font-bold text-sm uppercase">Deviation Investigation Report</p>
            <p className="text-[10px] mt-1">GMP Compliant | 21 CFR Part 11</p>
          </div>
          <div className="p-3 text-[10px] space-y-1">
            <p><strong>Format No.:</strong> SOP/QA/DEV/F01-01</p>
            <p><strong>Effective Date:</strong> {fmt(record.created_at)}</p>
            <p><strong>Page:</strong> 1 of 1</p>
          </div>
        </div>
        <div className="p-4 text-center bg-slate-50">
          <h1 className="text-lg font-bold uppercase">Deviation Report</h1>
          <p className="font-mono font-bold text-sm mt-1">{record.deviation_number}</p>
        </div>
      </header>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 Deviation Details</h2>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Deviation Number', record.deviation_number],
              ['Deviation Date', fmt(record.deviation_date)],
              ['Department', record.department],
              ['Product Name', record.product_name],
              ['Batch Number', record.batch_number || '—'],
              ['Area / Location', record.area],
              ['Reported By', record.reported_by_name],
              ['Detected By', record.detected_by_name],
              ['Category', record.category],
              ['Type', record.planned_type],
              ['Criticality', record.criticality],
              ['Status', record.status.replace(/_/g, ' ')],
              ['Target Closure', fmt(record.target_closure_date)],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{label}</td>
                <td className="border border-black p-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Description & Immediate Action</h2>
        <p className="border border-black p-2 mb-2"><strong>Title:</strong> {record.title}</p>
        <p className="border border-black p-2 mb-2"><strong>Description:</strong> {record.description}</p>
        <p className="border border-black p-2"><strong>Immediate Action:</strong> {record.immediate_action}</p>
      </section>

      <section className="mb-4">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Impact Flags</h2>
        <table className="w-full border border-black text-[10px]">
          <tbody>
            {[
              ['Batch Impacted', yn(record.batch_impacted)],
              ['Product Quality Impacted', yn(record.product_quality_impacted)],
              ['Patient Safety Impacted', yn(record.patient_safety_impacted)],
              ['Regulatory Impact', yn(record.regulatory_impact)],
              ['Repeat Deviation', yn(record.repeat_deviation)],
            ].map(([label, value]) => (
              <tr key={String(label)}>
                <td className="border border-black p-1.5 w-1/2 font-semibold bg-slate-50">{label}</td>
                <td className="border border-black p-1.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {investigation && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Investigation & Root Cause</h2>
          <table className="w-full border border-black text-[10px]">
            <tbody>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50 w-1/3">RCA Method</td><td className="border border-black p-1.5">{investigation.rca_method}</td></tr>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Investigator</td><td className="border border-black p-1.5">{investigation.investigator_name}</td></tr>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Root Cause Details</td><td className="border border-black p-1.5">{investigation.root_cause_details}</td></tr>
              <tr><td className="border border-black p-1.5 font-semibold bg-slate-50">Investigation Summary</td><td className="border border-black p-1.5">{investigation.investigation_summary}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {impact && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Impact Assessment</h2>
          <p className="border border-black p-2 mb-2">{impact.impact_summary}</p>
          <p className="border border-black p-2"><strong>CAPA Required:</strong> {yn(impact.capa_required)} — {impact.capa_justification}</p>
        </section>
      )}

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">6.0 CAPA</h2>
        <p className="border border-black p-2">
          CAPA Required: {yn(record.capa_required)} | Linked CAPA: {record.linked_capa_number || '—'}
        </p>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">7.0 Approval Signatures</h2>
        <table className="w-full border border-black text-[10px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1.5">Approver</th>
            <th className="border border-black p-1.5">Role</th>
            <th className="border border-black p-1.5">Decision</th>
            <th className="border border-black p-1.5">E-Signature</th>
            <th className="border border-black p-1.5">Date</th>
          </tr></thead>
          <tbody>
            {approvals.length ? approvals.map((a) => (
              <tr key={a.id}>
                <td className="border border-black p-1.5">{a.approver_name}</td>
                <td className="border border-black p-1.5">{a.approver_role}</td>
                <td className="border border-black p-1.5">{a.decision}</td>
                <td className="border border-black p-1.5 font-serif italic">{a.e_signature}</td>
                <td className="border border-black p-1.5">{fmt(a.signed_at)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="border border-black p-2 text-center text-muted-foreground">Pending approval</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="break-inside-avoid">
        <h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">8.0 Audit Trail Summary</h2>
        <table className="w-full border border-black text-[9px]">
          <thead><tr className="bg-slate-100">
            <th className="border border-black p-1">Date/Time</th>
            <th className="border border-black p-1">User</th>
            <th className="border border-black p-1">Action</th>
          </tr></thead>
          <tbody>
            {auditLogs.slice(0, 15).map((log, i) => (
              <tr key={i}>
                <td className="border border-black p-1">{String(log.dateTime || '')}</td>
                <td className="border border-black p-1">{String(log.userName || '')}</td>
                <td className="border border-black p-1">{String(log.action || '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-6 text-[9px] text-center border-t pt-2">
        This document is electronically generated and controlled. Unauthorized reproduction is prohibited.
        <br />Skymap Pharmaceuticals Pvt. Ltd. | Odisha, India
      </footer>
    </article>
  );
}

export function DeviationTimeline({ events }: { events: { date: string; title: string; description: string; user?: string }[] }) {
  return (
    <div className="space-y-4">
      {events.map((event, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/30" />
            {i < events.length - 1 && <div className="w-px flex-1 bg-border min-h-[2rem]" />}
          </div>
          <div className="pb-4 flex-1">
            <p className="text-xs text-muted-foreground">{new Date(event.date).toLocaleString('en-IN')}</p>
            <p className="font-medium text-sm">{event.title}</p>
            <p className="text-sm text-muted-foreground">{event.description}</p>
            {event.user && <p className="text-xs text-muted-foreground mt-1">By: {event.user}</p>}
          </div>
        </div>
      ))}
      {!events.length && <p className="text-sm text-muted-foreground text-center py-8">No timeline events yet</p>}
    </div>
  );
}

export { DeviationStatusBadge, DeviationCriticalityBadge };
