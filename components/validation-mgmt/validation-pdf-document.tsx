'use client';

import type { ValidationRecord, ValidationProtocol, ValidationExecutionStep, ValidationApproval, ProcessValidationData, CleaningValidationData, CsvValidationData } from '@/lib/validation-mgmt-types';

export function ValidationPdfDocument({
  record, protocol, steps, processData, cleaningData, csvData,
}: {
  record: ValidationRecord;
  protocol: ValidationProtocol | null;
  steps: ValidationExecutionStep[];
  processData: ProcessValidationData | null;
  cleaningData: CleaningValidationData | null;
  csvData: CsvValidationData | null;
}) {
  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 space-y-6" id="validation-report">
      <header className="border-b pb-4">
        <h1 className="text-xl font-bold">{record.validation_type} — Validation Report</h1>
        <p className="text-sm text-gray-600">{record.validation_number} · Generated {new Date().toLocaleDateString()}</p>
      </header>
      <section>
        <h2 className="font-semibold mb-2">Validation Overview</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {[['Title', record.validation_title], ['Department', record.department], ['Status', record.validation_status],
              ['Equipment', record.equipment_name || record.system_name], ['Product', record.product_name],
              ['Protocol', `${record.protocol_number} v${record.protocol_version}`],
              ['Prepared By', record.prepared_by_name], ['Approved By', record.approved_by_name || '—']].map(([k, v]) => (
              <tr key={k} className="border-b"><td className="py-1 pr-4 font-medium w-40">{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {protocol && (
        <section><h2 className="font-semibold mb-2">Protocol</h2>
          {[['Objective', protocol.objective], ['Scope', protocol.scope], ['Acceptance Criteria', protocol.acceptance_criteria]].map(([k, v]) => (
            v ? <div key={k} className="mb-2"><p className="text-xs font-bold">{k}</p><p className="text-sm">{v}</p></div> : null
          ))}
        </section>
      )}
      {steps.length > 0 && (
        <section><h2 className="font-semibold mb-2">Execution Results</h2>
          <table className="w-full text-xs border"><thead><tr className="bg-gray-100">
            <th className="p-1 border">Step</th><th className="p-1 border">Description</th><th className="p-1 border">Result</th><th className="p-1 border">Pass/Fail</th>
          </tr></thead><tbody>{steps.map((s) => (
            <tr key={s.id}><td className="p-1 border">{s.test_step_no}</td><td className="p-1 border">{s.test_description}</td>
              <td className="p-1 border">{s.actual_result}</td><td className="p-1 border">{s.pass_fail}</td></tr>
          ))}</tbody></table>
        </section>
      )}
      {processData && (
        <section><h2 className="font-semibold mb-2">Process Validation</h2>
          <p className="text-sm">CPP: {processData.cpp_parameter} · CQA: {processData.cqa_parameter}</p>
          <p className="text-sm">Conclusion: {processData.conclusion}</p>
        </section>
      )}
      {cleaningData && (
        <section><h2 className="font-semibold mb-2">Cleaning Validation</h2>
          <p className="text-sm">{cleaningData.product_from} → {cleaningData.product_to} · Status: {cleaningData.cleaning_status}</p>
        </section>
      )}
      {csvData && (
        <section><h2 className="font-semibold mb-2">CSV Validation</h2>
          <p className="text-sm">System: {csvData.system_name} · GxP: {csvData.gxp_impact} · Part 11: {csvData.part11_assessment}</p>
        </section>
      )}
    </div>
  );
}
