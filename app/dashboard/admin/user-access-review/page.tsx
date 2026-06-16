'use client';

import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { ADMIN_COLLECTIONS, ACCESS_REVIEW_STATUSES, RECORD_STATUSES } from '@/lib/admin/constants';
import { accessReviewSchema } from '@/lib/admin/schemas';
import { StatusBadge } from '@/components/admin/admin-data-table';

export default function UserAccessReviewPage() {
  return (
    <MasterCrudPage
      title="User Access Review"
      description="Periodic user access reviews for GxP compliance and 21 CFR Part 11"
      collection={ADMIN_COLLECTIONS.accessReviews}
      module="Admin"
      schema={accessReviewSchema}
      defaultValues={{
        reviewId: '', userId: '', userName: '', department: '', role: '',
        reviewPeriod: '', reviewerName: '', reviewStatus: 'Pending',
        findings: '', actionTaken: '', reviewDate: '', nextReviewDate: '', status: 'Active',
      }}
      uniqueFields={[{ field: 'reviewId', label: 'Review ID' }]}
      fields={[
        { name: 'reviewId', label: 'Review ID', required: true },
        { name: 'userName', label: 'User Name', required: true },
        { name: 'department', label: 'Department' },
        { name: 'role', label: 'Role' },
        { name: 'reviewPeriod', label: 'Review Period' },
        { name: 'reviewerName', label: 'Reviewer' },
        { name: 'reviewStatus', label: 'Review Status', type: 'select', options: ACCESS_REVIEW_STATUSES.map((s) => ({ label: s, value: s })) },
        { name: 'reviewDate', label: 'Review Date', type: 'date' },
        { name: 'nextReviewDate', label: 'Next Review Date', type: 'date' },
        { name: 'findings', label: 'Findings', type: 'textarea', colSpan: 2 },
        { name: 'actionTaken', label: 'Action Taken', type: 'textarea', colSpan: 2 },
        { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUSES.map((s) => ({ label: s, value: s })) },
      ]}
      columns={[
        { key: 'reviewId', header: 'Review ID' },
        { key: 'userName', header: 'User' },
        { key: 'department', header: 'Department' },
        { key: 'reviewStatus', header: 'Status', render: (r) => <StatusBadge status={r.reviewStatus} /> },
        { key: 'reviewerName', header: 'Reviewer' },
        { key: 'reviewDate', header: 'Review Date' },
        { key: 'nextReviewDate', header: 'Next Review' },
      ]}
      statusOptions={[...ACCESS_REVIEW_STATUSES, ...RECORD_STATUSES]}
    />
  );
}
