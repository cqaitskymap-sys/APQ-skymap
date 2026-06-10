'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES, ADMIN_MODULES } from '@/lib/admin/constants';
import { workflowSchema } from '@/lib/admin/schemas';
import { ADMIN_ROLES } from '@/lib/admin/constants';

const roleOptions = ADMIN_ROLES.map((r) => ({ label: r.name, value: r.id }));

export default function WorkflowsPage() {
  return (
    <MasterCrudPage
      title="Workflow Configuration"
      description="Configure approval workflows for each QMS module"
      collection={ADMIN_COLLECTIONS.workflows}
      module="Admin"
      schema={workflowSchema}
      defaultValues={{
        moduleName: 'PQR', initiatorRole: 'qa_executive', reviewerRole: 'qa_manager',
        approverRole: 'head_qa', escalationRole: 'head_qa', approvalLevels: 6,
        autoEscalationDays: 3, allowRejection: true, allowResubmission: true,
        requireESignature: true, workflowChain: 'QA Executive → QA Manager → QC Manager → Production Manager → Warehouse Manager → Engineering Manager → Head QA',
        status: 'Active',
      }}
      fields={[
        { name: 'moduleName', label: 'Module Name', type: 'select', required: true, options: ADMIN_MODULES.filter(m => m !== 'Dashboard').map((m) => ({ label: m, value: m })) },
        { name: 'initiatorRole', label: 'Initiator Role', type: 'select', options: roleOptions },
        { name: 'reviewerRole', label: 'Reviewer Role', type: 'select', options: roleOptions },
        { name: 'approverRole', label: 'Approver Role', type: 'select', options: roleOptions },
        { name: 'escalationRole', label: 'Escalation Role', type: 'select', options: roleOptions },
        { name: 'approvalLevels', label: 'Approval Levels', type: 'number' },
        { name: 'autoEscalationDays', label: 'Auto Escalation Days', type: 'number' },
        { name: 'workflowChain', label: 'Workflow Chain', type: 'textarea', colSpan: 2 },
        { name: 'allowRejection', label: 'Allow Rejection', type: 'switch' },
        { name: 'allowResubmission', label: 'Allow Resubmission', type: 'switch' },
        { name: 'requireESignature', label: 'Require e-Signature', type: 'switch' },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'moduleName', header: 'Module' },
        { key: 'initiatorRole', header: 'Initiator', render: (r) => r.initiatorRole?.replace(/_/g, ' ') },
        { key: 'approverRole', header: 'Approver', render: (r) => r.approverRole?.replace(/_/g, ' ') },
        { key: 'approvalLevels', header: 'Levels' },
        { key: 'autoEscalationDays', header: 'Escalation Days' },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
