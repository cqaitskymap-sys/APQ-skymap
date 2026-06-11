'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { SystemPicker } from './csv-filters';
import { useCsvActor } from '@/hooks/use-csv-mgmt';
import {
  gxpAssessmentSchema, riskAssessmentSchema, ursSchema, frsSchema, designSpecSchema,
  testScriptSchema, traceabilitySchema, part11Schema, validationReportSchema, periodicReviewSchema,
  type GxpAssessmentInput, type RiskAssessmentInput, type UrsInput, type FrsInput,
  type DesignSpecInput, type TestScriptInput, type TraceabilityInput, type Part11Input,
  type ValidationReportInput, type PeriodicReviewInput,
} from '@/lib/csv-mgmt-schemas';
import {
  saveGxpAssessment, createRiskAssessment, createUrs, createFrs, createDesignSpec,
  createTestScript, saveTraceabilityRow, savePart11Assessment, saveValidationReport, savePeriodicReview,
} from '@/lib/csv-mgmt-service';
import { GXP_CLASSIFICATIONS, REQUIREMENT_TYPES, PASS_FAIL, calcRpn } from '@/lib/csv-mgmt-types';
import type { CsvSystem } from '@/lib/csv-mgmt-types';

function useSystemFields(systems: CsvSystem[]) {
  return (setValue: (k: string, v: string) => void) => (id: string, name: string) => {
    setValue('system_id', id);
    setValue('system_name', name);
  };
}

export function GxpAssessmentForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<GxpAssessmentInput>({
    resolver: zodResolver(gxpAssessmentSchema),
    defaultValues: { system_id: '', system_name: '', used_for_gmp: false, stores_gmp_data: false, generates_batch_data: false, controls_equipment: false, manages_e_records: false, uses_e_signatures: false, gxp_classification: 'Non-GxP', assessment_conclusion: '', assessment_date: new Date().toISOString().split('T')[0] },
  });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof GxpAssessmentInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await saveGxpAssessment(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (
        <FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>
      )} />
      <FormField control={form.control} name="gxp_classification" render={({ field }) => (
        <FormItem><FormLabel>GxP Classification</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{GXP_CLASSIFICATIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      {(['used_for_gmp', 'stores_gmp_data', 'generates_batch_data', 'controls_equipment', 'manages_e_records', 'uses_e_signatures'] as const).map((f) => (
        <FormField key={f} control={form.control} name={f} render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormLabel className="capitalize flex-1">{f.replace(/_/g, ' ')}</FormLabel>
            <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
        )} />
      ))}
      <FormField control={form.control} name="assessment_conclusion" render={({ field }) => (
        <FormItem><FormLabel>Conclusion</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Assessment</Button>
    </form></Form>
  );
}

export function RiskAssessmentForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<RiskAssessmentInput>({
    resolver: zodResolver(riskAssessmentSchema),
    defaultValues: { system_id: '', system_name: '', requirement_id: '', risk_description: '', severity: 3, occurrence: 3, detectability: 3, mitigation: '', residual_risk: '', approval_status: 'Pending' },
  });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof RiskAssessmentInput, v));
  const sev = form.watch('severity'); const occ = form.watch('occurrence'); const det = form.watch('detectability');
  const preview = calcRpn(sev || 1, occ || 1, det || 1);
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createRiskAssessment(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (
        <FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>
      )} />
      <FormField control={form.control} name="risk_description" render={({ field }) => (
        <FormItem><FormLabel>Risk Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <div className="grid grid-cols-3 gap-2">
        {(['severity', 'occurrence', 'detectability'] as const).map((f) => (
          <FormField key={f} control={form.control} name={f} render={({ field }) => (
            <FormItem><FormLabel className="capitalize">{f}</FormLabel><FormControl><Input type="number" min={1} max={10} {...field} /></FormControl></FormItem>
          )} />
        ))}
      </div>
      <p className="text-sm bg-muted p-2 rounded">RPN: <strong>{preview.rpn}</strong> — {preview.risk_level}</p>
      <FormField control={form.control} name="mitigation" render={({ field }) => (
        <FormItem><FormLabel>Mitigation</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Risk</Button>
    </form></Form>
  );
}

export function UrsForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<UrsInput>({ resolver: zodResolver(ursSchema), defaultValues: { system_id: '', system_name: '', requirement_no: '', requirement_description: '', requirement_type: 'Functional', priority: 'Medium', gxp_critical: false, acceptance_criteria: '', status: 'Draft' } });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof UrsInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createUrs(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <FormField control={form.control} name="requirement_no" render={({ field }) => (<FormItem><FormLabel>Requirement No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="requirement_description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="requirement_type" render={({ field }) => (
        <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>{REQUIREMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></FormItem>
      )} />
      <FormField control={form.control} name="gxp_critical" render={({ field }) => (<FormItem className="flex gap-2 items-center"><FormLabel>GxP Critical</FormLabel><Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>)} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Create URS</Button>
    </form></Form>
  );
}

export function FrsForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<FrsInput>({ resolver: zodResolver(frsSchema), defaultValues: { system_id: '', system_name: '', linked_urs_no: '', functional_specification: '', system_response: '', acceptance_criteria: '', status: 'Draft' } });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof FrsInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createFrs(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <FormField control={form.control} name="linked_urs_no" render={({ field }) => (<FormItem><FormLabel>Linked URS No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="functional_specification" render={({ field }) => (<FormItem><FormLabel>Functional Spec</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Create FRS</Button>
    </form></Form>
  );
}

export function DesignSpecForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<DesignSpecInput>({ resolver: zodResolver(designSpecSchema), defaultValues: { system_id: '', system_name: '', linked_frs_no: '', design_description: '', technical_design: '', database_collection: '', api_function: '', ui_component: '', status: 'Draft' } });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof DesignSpecInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createDesignSpec(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <FormField control={form.control} name="linked_frs_no" render={({ field }) => (<FormItem><FormLabel>Linked FRS No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="design_description" render={({ field }) => (<FormItem><FormLabel>Design Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Create DS</Button>
    </form></Form>
  );
}

export function TestScriptForm({ systems, onSuccess, phase }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void; phase: 'IQ' | 'OQ' | 'PQ' }) {
  const actor = useCsvActor();
  const form = useForm<TestScriptInput>({
    resolver: zodResolver(testScriptSchema),
    defaultValues: { system_id: '', system_name: '', test_phase: phase, test_script_no: '', linked_requirement: '', test_objective: '', precondition: '', test_steps: '', expected_result: '', actual_result: '', pass_fail: 'N/A', execution_date: new Date().toISOString().split('T')[0], remarks: '' },
  });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof TestScriptInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createTestScript({ ...d, test_phase: phase }, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <FormField control={form.control} name="test_script_no" render={({ field }) => (<FormItem><FormLabel>Test Script No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="test_objective" render={({ field }) => (<FormItem><FormLabel>Objective</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="test_steps" render={({ field }) => (<FormItem><FormLabel>Test Steps</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="expected_result" render={({ field }) => (<FormItem><FormLabel>Expected Result</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="actual_result" render={({ field }) => (<FormItem><FormLabel>Actual Result</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="pass_fail" render={({ field }) => (
        <FormItem><FormLabel>Pass/Fail</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>{PASS_FAIL.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Record {phase} Test</Button>
    </form></Form>
  );
}

export function TraceabilityForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<TraceabilityInput>({ resolver: zodResolver(traceabilitySchema), defaultValues: { system_id: '', system_name: '', urs_no: '', frs_no: '', ds_no: '', iq_test_no: '', oq_test_no: '', pq_test_no: '', status: 'Draft', gap_identified: false } });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof TraceabilityInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await saveTraceabilityRow(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <div className="grid grid-cols-2 gap-2">
        {(['urs_no', 'frs_no', 'ds_no', 'iq_test_no', 'oq_test_no', 'pq_test_no'] as const).map((f) => (
          <FormField key={f} control={form.control} name={f} render={({ field }) => (<FormItem><FormLabel className="uppercase">{f.replace('_', ' ')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
        ))}
      </div>
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Add Row</Button>
    </form></Form>
  );
}

export function Part11Form({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<Part11Input>({
    resolver: zodResolver(part11Schema),
    defaultValues: { system_id: '', system_name: '', audit_trail_available: false, audit_trail_secure: false, audit_trail_reviewable: false, e_signature_available: false, password_policy_available: false, user_access_control: false, data_backup: false, record_retention: false, time_stamped_records: false, system_security: false, assessment_result: 'Pending', gap_action: '' },
  });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof Part11Input, v));
  const checks = ['audit_trail_available', 'audit_trail_secure', 'audit_trail_reviewable', 'e_signature_available', 'password_policy_available', 'user_access_control', 'data_backup', 'record_retention', 'time_stamped_records', 'system_security'] as const;
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await savePart11Assessment(d, actor); onSuccess(); })} className="space-y-3">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      {checks.map((f) => (
        <FormField key={f} control={form.control} name={f} render={({ field }) => (
          <FormItem className="flex items-center justify-between"><FormLabel className="capitalize text-sm">{f.replace(/_/g, ' ')}</FormLabel>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormItem>
        )} />
      ))}
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Part 11 Assessment</Button>
    </form></Form>
  );
}

export function ValidationReportForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<ValidationReportInput>({ resolver: zodResolver(validationReportSchema), defaultValues: { system_id: '', system_name: '', validation_summary: '', deviations_observed: 0, open_issues: 0, test_summary: '', requirement_coverage_percent: 0, final_conclusion: '', recommended_status: 'Validated' } });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof ValidationReportInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await saveValidationReport(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <FormField control={form.control} name="validation_summary" render={({ field }) => (<FormItem><FormLabel>Summary</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="final_conclusion" render={({ field }) => (<FormItem><FormLabel>Final Conclusion</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Report</Button>
    </form></Form>
  );
}

export function PeriodicReviewForm({ systems, onSuccess }: { systems: CsvSystem[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useCsvActor();
  const form = useForm<PeriodicReviewInput>({ resolver: zodResolver(periodicReviewSchema), defaultValues: { system_id: '', system_name: '', review_period: '', incidents: 0, changes: 0, deviations: 0, access_review_completed: false, backup_review_completed: false, audit_trail_review_completed: false, system_performance_review: '', validation_status: 'Validated', recommendation: '', next_review_due: '' } });
  const pick = useSystemFields(systems)((k, v) => form.setValue(k as keyof PeriodicReviewInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await savePeriodicReview(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="system_id" render={() => (<FormItem><FormLabel>System</FormLabel><SystemPicker systems={systems} value={form.watch('system_id')} onChange={pick} /></FormItem>)} />
      <FormField control={form.control} name="review_period" render={({ field }) => (<FormItem><FormLabel>Review Period</FormLabel><FormControl><Input placeholder="2026-Q1" {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="next_review_due" render={({ field }) => (<FormItem><FormLabel>Next Review Due</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
      <FormField control={form.control} name="recommendation" render={({ field }) => (<FormItem><FormLabel>Recommendation</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Review</Button>
    </form></Form>
  );
}
