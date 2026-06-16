import { AnnualReviewAccessGuard } from '@/components/cpv/annual-review/annual-review-access-guard';
import { AnnualReviewPage } from '@/components/cpv/annual-review/annual-review-page';

export const dynamic = 'force-dynamic';

export default function AnnualReviewRoutePage() {
  return (
    <AnnualReviewAccessGuard>
      <AnnualReviewPage />
    </AnnualReviewAccessGuard>
  );
}
