import { redirect } from 'next/navigation';

export default function RecallAnalyticsRedirect() {
  redirect('/qms/recall/reports');
}
