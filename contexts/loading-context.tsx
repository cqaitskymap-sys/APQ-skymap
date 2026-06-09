'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { PremiumLoader } from '@/components/loaders/premium-loader';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  message: string;
  setMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const value = {
    isLoading,
    setLoading,
    message,
    setMessage,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <GlobalLoader />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}

function GlobalLoader() {
  const { isLoading, message } = useLoading();
  const [shouldRender, setShouldRender] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShouldRender(true);
      return;
    }

    const timer = window.setTimeout(() => setShouldRender(false), 320);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div
      className={`premium-loader-overlay ${isLoading ? 'is-visible' : 'is-leaving'}`}
      aria-hidden={!isLoading}
    >
      <PremiumLoader
        compact
        message={message || 'Preparing your workspace'}
        className="min-h-0"
      />
    </div>
  );
}

