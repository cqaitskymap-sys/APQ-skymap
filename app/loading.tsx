import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <LoadingSpinner label="Loading module..." />
    </div>
  );
}
