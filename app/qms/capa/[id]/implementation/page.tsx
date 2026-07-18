import { redirect } from 'next/navigation';

export default async function CapaImplementationRedirect(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/qms/capa/${params.id}`);
}
