import { CcClosurePage } from '@/components/change-control/closure/cc-closure-page';

export default function Page({ params }: { params: { id: string } }) {
  return <CcClosurePage changeId={params.id} />;
}
