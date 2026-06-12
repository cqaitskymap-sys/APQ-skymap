'use client';

import { isDemoAuthEnabled, shouldUseDemoAuth } from '@/lib/demo-auth-config';
import { isFirebaseConfigured, getFirebaseSetupMessage } from '@/lib/firebase';
import { AlertTriangle, Info } from 'lucide-react';

export function FirebaseSetupBanner() {
  if (shouldUseDemoAuth()) {
    const isExplicitDemo = isDemoAuthEnabled();
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-900 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          {isExplicitDemo ? (
            <>Demo auth mode is on. Use demo login buttons or <code className="bg-blue-100 px-1 rounded">admin@pharmaQMS.com</code> / password <code className="bg-blue-100 px-1 rounded">demo123456</code>.</>
          ) : (
            <>
              Firebase env vars are missing on this deployment — running in <strong>demo mode</strong>.
              Use Demo Access on the login page, or add <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_FIREBASE_*</code> in{' '}
              <strong>Netlify → Site configuration → Environment variables</strong>, then redeploy.
            </>
          )}
        </span>
      </div>
    );
  }

  if (isFirebaseConfigured()) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{getFirebaseSetupMessage()}</span>
    </div>
  );
}
