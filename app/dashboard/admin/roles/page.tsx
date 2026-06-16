import { redirect } from 'next/navigation';

export default function DashboardRolesRedirect() {
  redirect('/admin/roles');
}
