import { redirect } from 'next/navigation';

export default function ComplaintAnalyticsRedirect() {
  redirect('/qms/complaints/reports');
}
