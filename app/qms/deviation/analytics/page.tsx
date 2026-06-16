import { redirect } from 'next/navigation';

export default function DeviationAnalyticsRedirect() {
  redirect('/qms/deviation/reports');
}
