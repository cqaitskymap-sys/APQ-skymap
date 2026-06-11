import { redirect } from 'next/navigation';

export default function LoginRedirect({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  const qs = searchParams?.redirect ? `?redirect=${encodeURIComponent(searchParams.redirect)}` : '';
  redirect(`/auth/login${qs}`);
}
