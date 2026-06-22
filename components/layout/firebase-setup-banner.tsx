'use client';

import { useEffect, useState } from 'react';
import { isFirebaseConfigured, getFirebaseSetupMessage } from '@/lib/firebase-config';
import { AlertTriangle } from 'lucide-react';

export function FirebaseSetupBanner() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (isFirebaseConfigured()) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{getFirebaseSetupMessage()}</span>
    </div>
  );
}
