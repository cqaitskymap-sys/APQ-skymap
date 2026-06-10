'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { approvalMatrixSchema } from '@/lib/admin/schemas';
import { ADMIN_ROLES } from '@/lib/admin/constants';

const modules = ['PQR', 'CPV', 'Deviation', 'OOS', 'CAPA', 'Change Control', 'Document Approval'];
const roleOptions = ADMIN_ROLES.map((r) => ({ label: r.name, value: r.id }));

export default function ApprovalMatrixPage() {
  return (
    <MasterCrudPage
      title="Approval Matrix"
      description="Define multi-level reviewers and approvers per module and department"
      collection={ADMIN_COLLECTIONS.approvalMatrix}
      module="Admin"
      schema={approvalMatrixSchema}
      defaultValues={{
        module: 'PQR', department: 'QA', level1Reviewer: 'qa_executive',
        level2Reviewer: 'qa_manager', finalApprover: 'head_qa',
        mandatoryRemarks: true, eSignRequired: true, status: 'Active',
      }}
      fields={[
        { name: 'module', label: 'Module', type: 'select', required: true, options: modules.map((m) => ({ label: m, value: m })) },
        { name: 'department', label: 'Department' },
        { name: 'level1Reviewer', label: 'Level 1 Reviewer', type: 'select', options: roleOptions },
        { name: 'level2Reviewer', label: 'Level 2 Reviewer', type: 'select', options: roleOptions },
        { name: 'finalApprover', label: 'Final Approver', type: 'select', options: roleOptions },
        { name: 'mandatoryRemarks', label: 'Mandatory Remarks', type: 'switch' },
        { name: 'eSignRequired', label: 'e-Sign Required', type: 'switch' },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'module', header: 'Module' },
        { key: 'department', header: 'Department' },
        { key: 'level1Reviewer', header: 'L1 Reviewer', render: (r) => r.level1Reviewer?.replace(/_/g, ' ') },
        { key: 'level2Reviewer', header: 'L2 Reviewer', render: (r) => r.level2Reviewer?.replace(/_/g, ' ') },
        { key: 'finalApprover', header: 'Final Approver', render: (r) => r.finalApprover?.replace(/_/g, ' ') },
        { key: 'status', header: 'Status' },
      ]}
    />
  );
}
