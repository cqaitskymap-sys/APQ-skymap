'use client';

import { PqrSubNav } from '@/components/pqr/pqr-sub-nav';

export default function PqrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {children}
    </div>
  );
}

export { PqrSubNav };
