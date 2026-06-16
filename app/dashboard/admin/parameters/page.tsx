import { redirect } from 'next/navigation';

export default function LegacyParametersRedirect() {
  redirect('/admin/parameters');
}
