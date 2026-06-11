import { redirect } from 'next/navigation';

export default function DashboardComplaintsRedirect() {
  redirect('/qms/complaints');
}
