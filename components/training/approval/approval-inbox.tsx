'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import type { ApprovalRequest } from '@/lib/training-approval-types';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalInboxProps {
  requests: ApprovalRequest[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  canAct: boolean;
  onView: (request: ApprovalRequest) => void;
  onApprove: (request: ApprovalRequest) => void;
  onReject: (request: ApprovalRequest) => void;
  emptyMessage?: string;
  showSelection?: boolean;
}

export function ApprovalInbox({
  requests, selectedIds, onSelectChange, canAct,
  onView, onApprove, onReject, emptyMessage = 'No pending approvals', showSelection = true,
}: ApprovalInboxProps) {
  const columns: ColumnDef<ApprovalRequest>[] = [
    ...(showSelection && canAct ? [{
      key: 'select',
      header: '',
      render: (r: ApprovalRequest) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onCheckedChange={(c) => onSelectChange(c ? [...selectedIds, r.id] : selectedIds.filter((id) => id !== r.id))}
        />
      ),
    }] : []),
    { key: 'workflow_number', header: 'Workflow #', render: (r) => <span className="font-mono text-xs">{r.workflow_number}</span> },
    { key: 'workflow_type', header: 'Type', render: (r) => <span className="text-xs">{r.workflow_type}</span> },
    { key: 'reference_number', header: 'Reference', render: (r) => r.reference_number },
    { key: 'status', header: 'Status', render: (r) => <ApprovalStatusBadge status={r.current_status} /> },
    { key: 'priority', header: 'Priority', render: (r) => r.priority },
    { key: 'department', header: 'Dept', render: (r) => r.department },
    {
      key: 'due_date', header: 'Due',
      render: (r) => (
        <span className={r.due_date < new Date().toISOString().slice(0, 10) ? 'text-red-600 font-medium' : ''}>
          {r.due_date}
        </span>
      ),
    },
    { key: 'step', header: 'Step', render: (r) => `${r.current_step}/${r.total_steps}` },
  ];

  return (
    <ResponsiveDataTable
      data={requests}
      columns={columns}
      emptyMessage={emptyMessage}
      searchKeys={['workflow_number', 'reference_number', 'workflow_type']}
      mobileTitleKey="workflow_type"
      mobileSubtitleKey="workflow_number"
      actions={canAct ? (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onView(r)}>View</Button>
          <Button size="sm" onClick={() => onApprove(r)}><CheckCircle className="h-3.5 w-3.5 mr-1" />Approve</Button>
          <Button size="sm" variant="destructive" onClick={() => onReject(r)}><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
        </div>
      ) : undefined}
    />
  );
}
