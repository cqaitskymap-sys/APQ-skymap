import { redirect } from 'next/navigation';

export default async function PqrDetailRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/dashboard/pqr/${params.id}`);
}
