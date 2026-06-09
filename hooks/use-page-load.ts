'use client';

import { useEffect, useState } from 'react';

interface UsePageLoadProps {
  delay?: number;
}

export function usePageLoad({ delay = 300 }: UsePageLoadProps = {}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return { isLoading, showLoader: isLoading };
}
