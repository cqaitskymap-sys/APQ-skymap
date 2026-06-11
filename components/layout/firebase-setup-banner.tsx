'use client';

import { isDemoAuthEnabled } from '@/lib/demo-auth-config';
import { isFirebaseConfigured, getFirebaseSetupMessage } from '@/lib/firebase';
import { AlertTriangle, Info } from 'lucide-react';

export function FirebaseSetupBanner() {
  if (isDemoAuthEnabled()) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-900 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Demo auth mode is on (local only). Sign up and login work without Firebase. Set{' '}
          <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_DEMO_AUTH=false</code> and configure{' '}
          <code className="bg-blue-100 px-1 rounded">.env.local</code> for production Firebase.
        </span>
      </div>
    );
  }

  if (isFirebaseConfigured()) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {getFirebaseSetupMessage() || (
          <>
            Firebase is not configured. Copy{' '}
            <code className="bg-amber-100 px-1 rounded">.env.local.example</code> to{' '}
            <code className="bg-amber-100 px-1 rounded">.env.local</code> and add your project credentials.
          </>
        )}
      </span>
    </div>
  );
}
