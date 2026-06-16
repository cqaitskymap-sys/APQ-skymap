import { redirect } from 'next/navigation';

export default function StatisticalProcessControlDetailAliasPage({ params }: { params: { id: string } }) {
  redirect(`/cpv/control-charts/${params.id}`);
}
