'use client';

import { useEffect, useState } from 'react';
import { useLoading } from '@/contexts/loading-context';

export function useFirebaseLoading(loading: boolean, message = 'Connecting to Firebase...') {
  const { startTask, endTask } = useLoading();

  useEffect(() => {
    if (loading) {
      startTask('firebase', { message, priority: 'critical' });
    } else {
      endTask('firebase');
    }
    return () => endTask('firebase');
  }, [loading, message, startTask, endTask]);
}

export function useAsyncOperation() {
  const { withLoading, startTask, endTask, updateTask } = useLoading();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const execute = async <T,>(
    id: string,
    fn: () => Promise<T>,
    options?: { message?: string; onRetry?: () => void }
  ): Promise<T | null> => {
    if (offline) throw new Error('You are offline. Please check your connection.');
    startTask(id, { message: options?.message, priority: 'medium' });
    try {
      return await fn();
    } catch (error) {
      if (options?.onRetry) options.onRetry();
      throw error;
    } finally {
      endTask(id);
    }
  };

  return { execute, withLoading, updateTask, offline };
}
