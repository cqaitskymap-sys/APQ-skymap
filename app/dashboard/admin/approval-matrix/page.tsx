import { redirect } from 'next/navigation';

export default function LegacyApprovalMatrixRedirect() {
  redirect('/admin/approval-matrix');
}
