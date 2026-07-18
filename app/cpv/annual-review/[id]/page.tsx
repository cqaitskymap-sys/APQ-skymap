import { AnnualReviewAccessGuard } from '@/components/cpv/annual-review/annual-review-access-guard';
import { AnnualReviewDetailView } from '@/components/cpv/annual-review/annual-review-detail-view';

export const dynamic = 'force-dynamic';

export default async function AnnualReviewDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <AnnualReviewAccessGuard>
      <AnnualReviewDetailView id={params.id} />
    </AnnualReviewAccessGuard>
  );
}
