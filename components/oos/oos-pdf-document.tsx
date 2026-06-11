'use client';

import type { OosRecord, OosPhase1, OosPhase2, OosImpactAssessment, OosApproval, OosCapaLink } from '@/lib/oos-types';

interface OosPdfDocumentProps {
  record: OosRecord;
  phase1: OosPhase1 | null;
  phase2: OosPhase2 | null;
  impact: OosImpactAssessment | null;
  capa: OosCapaLink | null;
  approvals: OosApproval[];
  auditLogs: Record<string, unknown>[];
}

export function OosPdfDocument({ record, phase1, phase2, impact, capa, approvals, auditLogs }: OosPdfDocumentProps) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const yn = (v: boolean) => v ? 'Yes' : 'No';

  return (
    <article id="oos-pdf-document" className="bg-white text-black p-8 max-w-[210mm] mx-auto text-[11px] leading-relaxed print:p-6">
      <header className="border-2 border-black mb-4">
        <div className="grid grid-cols-3 border-b border-black">
          <div className="p-3 border-r border-black text-center font-bold text-blue-800 text-sm">SKYMAP<br />PHARMACEUTICALS</div>
          <div className="p-3 border-r border-black text-center"><p className="font-bold text-sm uppercase">Out of Specification Investigation Report</p><p className="text-[10px] mt-1">GMP | 21 CFR Part 11</p></div>
          <div className="p-3 text-[10px] space-y-1"><p><strong>Format:</strong> SOP/QC/OOS/F01-01</p><p><strong>Date:</strong> {fmt(record.created_at)}</p></div>
        </div>
        <div className="p-4 text-center bg-slate-50"><h1 className="text-lg font-bold uppercase">OOS Report</h1><p className="font-mono font-bold mt-1">{record.oos_number}</p></div>
      </header>

      <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">1.0 OOS Details</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {[['OOS Number', record.oos_number], ['Date', fmt(record.oos_date)], ['Department', record.department], ['Product', record.product_name], ['Batch', record.batch_number], ['Test', record.test_name], ['Method', record.test_method], ['STP', record.stp_number], ['Spec No.', record.specification_number], ['Status', record.status.replace(/_/g, ' ')]].map(([l, v]) => (
            <tr key={String(l)}><td className="border border-black p-1.5 w-1/3 font-semibold bg-slate-50">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
          ))}
        </tbody></table>
      </section>

      <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">2.0 Result Details</h2>
        <table className="w-full border border-black text-[10px]"><tbody>
          {[['Parameter', record.parameter_name], ['Lower Limit', `${record.spec_lower_limit} ${record.unit}`], ['Upper Limit', `${record.spec_upper_limit} ${record.unit}`], ['Observed', `${record.observed_result} ${record.unit}`], ['Result Status', record.result_status], ['Critical Test', yn(record.is_critical_test)], ['Batch Release Blocked', yn(record.batch_release_blocked)]].map(([l, v]) => (
            <tr key={String(l)}><td className="border border-black p-1.5 font-semibold bg-slate-50 w-1/3">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
          ))}
        </tbody></table>
      </section>

      {phase1 && (
        <section className="mb-4 break-inside-avoid"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">3.0 Phase-I Laboratory Investigation</h2>
          <table className="w-full border border-black text-[10px]"><tbody>
            {[['Analyst', phase1.analyst_name], ['Instrument', phase1.instrument_used], ['Calibration', phase1.instrument_calibration_status], ['Standard', phase1.standard_used], ['Reagent', phase1.reagent_used], ['Calculation Verified', yn(phase1.calculation_verified)], ['Data Review', yn(phase1.data_review_completed)], ['Outcome', phase1.phase1_outcome], ['Findings', phase1.investigation_findings], ['Root Cause', phase1.root_cause_identified], ['Conclusion', phase1.phase1_conclusion]].map(([l, v]) => (
              <tr key={String(l)}><td className="border border-black p-1.5 font-semibold bg-slate-50 w-1/3">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {phase2 && (
        <section className="mb-4 break-inside-avoid"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">4.0 Phase-II Manufacturing Investigation</h2>
          <table className="w-full border border-black text-[10px]"><tbody>
            {[['Raw Material', phase2.raw_material_review], ['Equipment', phase2.equipment_review], ['Environmental', phase2.environmental_review], ['Process', phase2.process_review], ['Operator', phase2.operator_review], ['Root Cause', phase2.root_cause], ['Impact', phase2.impact_assessment], ['Corrective Action', phase2.corrective_action], ['Preventive Action', phase2.preventive_action], ['Conclusion', phase2.conclusion]].map(([l, v]) => (
              <tr key={String(l)}><td className="border border-black p-1.5 font-semibold bg-slate-50 w-1/3">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {impact && (
        <section className="mb-4 break-inside-avoid"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">5.0 Impact Assessment</h2>
          <table className="w-full border border-black text-[10px]"><tbody>
            {[['Product Impact', impact.product_impact], ['Batch Impact', impact.batch_impact], ['Patient Safety', impact.patient_safety_impact], ['Regulatory', impact.regulatory_impact], ['Recall Required', yn(impact.recall_required)]].map(([l, v]) => (
              <tr key={String(l)}><td className="border border-black p-1.5 font-semibold bg-slate-50 w-1/3">{l}</td><td className="border border-black p-1.5">{v}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">6.0 CAPA</h2>
        <p className="border border-black p-2">CAPA: {capa?.capa_number || record.linked_capa_number || '—'} | Status: {capa?.capa_status || '—'} | Effectiveness: {capa?.effectiveness_check || '—'}</p>
      </section>

      <section className="mb-4"><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">7.0 Approval Signatures</h2>
        <table className="w-full border border-black text-[10px]"><thead><tr className="bg-slate-100"><th className="border border-black p-1.5">Approver</th><th className="border border-black p-1.5">Role</th><th className="border border-black p-1.5">Decision</th><th className="border border-black p-1.5">E-Signature</th><th className="border border-black p-1.5">Date</th></tr></thead>
          <tbody>{approvals.length ? approvals.map((a) => (
            <tr key={a.id}><td className="border border-black p-1.5">{a.approver_name}</td><td className="border border-black p-1.5">{a.approver_role}</td><td className="border border-black p-1.5">{a.decision}</td><td className="border border-black p-1.5 italic">{a.e_signature}</td><td className="border border-black p-1.5">{fmt(a.signed_at)}</td></tr>
          )) : <tr><td colSpan={5} className="border border-black p-2 text-center">Pending</td></tr>}</tbody>
        </table>
      </section>

      <section><h2 className="font-bold text-xs uppercase bg-slate-200 px-2 py-1 border border-black mb-2">8.0 Audit Trail Summary</h2>
        <table className="w-full border border-black text-[9px]"><thead><tr className="bg-slate-100"><th className="border border-black p-1">Date/Time</th><th className="border border-black p-1">User</th><th className="border border-black p-1">Action</th></tr></thead>
          <tbody>{auditLogs.slice(0, 15).map((log, i) => (
            <tr key={i}><td className="border border-black p-1">{String(log.dateTime || '')}</td><td className="border border-black p-1">{String(log.userName || '')}</td><td className="border border-black p-1">{String(log.action || '')}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </article>
  );
}

export function OosTimeline({ events }: { events: { date: string; title: string; description: string; user?: string }[] }) {
  return (
    <div className="space-y-4">
      {events.map((e, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center"><div className="h-3 w-3 rounded-full bg-red-600 ring-4 ring-red-100" />{i < events.length - 1 && <div className="w-px flex-1 bg-border min-h-[2rem]" />}</div>
          <div className="pb-4 flex-1"><p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleString('en-IN')}</p><p className="font-medium text-sm">{e.title}</p><p className="text-sm text-muted-foreground">{e.description}</p>{e.user && <p className="text-xs text-muted-foreground mt-1">By: {e.user}</p>}</div>
        </div>
      ))}
      {!events.length && <p className="text-sm text-muted-foreground text-center py-8">No timeline events</p>}
    </div>
  );
}
