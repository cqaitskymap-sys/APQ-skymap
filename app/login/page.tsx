import { redirect } from 'next/navigation';

export default async function LoginRedirect(
  props: {
    searchParams?: Promise<{ redirect?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const qs = searchParams?.redirect ? `?redirect=${encodeURIComponent(searchParams.redirect)}` : '';
  redirect(`/auth/login${qs}`);
}
