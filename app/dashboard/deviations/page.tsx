import { redirect } from 'next/navigation';

export default function LegacyDeviationsRedirect() {
  redirect('/qms/deviation');
}
