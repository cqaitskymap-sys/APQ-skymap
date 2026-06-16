import { redirect } from 'next/navigation';

export default function LegacyPasswordPolicyRedirect() {
  redirect('/admin/system-settings/password-policy');
}
