import { redirect } from 'next/navigation';

export default async function StatisticalProcessControlDetailAliasPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/cpv/control-charts/${params.id}`);
}
