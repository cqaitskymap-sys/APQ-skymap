import { AnnualReviewAccessGuard } from '@/components/cpv/annual-review/annual-review-access-guard';
import { AnnualReviewDetailView } from '@/components/cpv/annual-review/annual-review-detail-view';

export const dynamic = 'force-dynamic';

export default function AnnualReviewDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <AnnualReviewAccessGuard>
      <AnnualReviewDetailView id={params.id} />
    </AnnualReviewAccessGuard>
  );
}
