'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLoading } from '@/contexts/loading-context';

export function AuthLoadingBridge() {
  const { loading } = useAuth();
  const { startTask, endTask } = useLoading();

  useEffect(() => {
    if (loading) {
      startTask('firebase-auth', { message: 'Authenticating...', priority: 'critical' });
    } else {
      endTask('firebase-auth');
    }
    return () => endTask('firebase-auth');
  }, [loading, startTask, endTask]);

  return null;
}
