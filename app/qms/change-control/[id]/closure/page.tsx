import { CcClosurePage } from '@/components/change-control/closure/cc-closure-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CcClosurePage changeId={params.id} />;
}
