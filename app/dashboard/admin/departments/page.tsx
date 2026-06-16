import { redirect } from 'next/navigation';

export default function DashboardDepartmentsRedirect() {
  redirect('/admin/departments');
}
