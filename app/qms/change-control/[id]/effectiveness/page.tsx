import { redirect } from 'next/navigation';

export default async function ChangeEffectivenessAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/qms/change-control/${id}/effectiveness-review`);
}
