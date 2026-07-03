'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from 'react';
import { AnimatePresence } from 'framer-motion';
import { PremiumFullScreenLoader } from '@/components/loading/loaders';
import { GlobalLoadingOverlay, NavigationLoader } from '@/components/loading/navigation-loader';
import type { LoadingPriority, LoadingTask } from '@/lib/loading/types';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  message: string;
  setMessage: (message: string) => void;
  progress: number | undefined;
  setProgress: (progress: number | undefined) => void;
  startTask: (id: string, options?: { message?: string; priority?: LoadingPriority; progress?: number }) => void;
  endTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Pick<LoadingTask, 'message' | 'progress'>>) => void;
  activeTaskCount: number;
  withLoading: <T>(fn: () => Promise<T>, options?: { message?: string; id?: string }) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

function GlobalLoaderOverlay() {
  const { isLoading, message, progress } = useLoading();
  const [shouldRender, setShouldRender] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShouldRender(true);
      return;
    }
    const timer = window.setTimeout(() => setShouldRender(false), 320);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  return (
    <AnimatePresence>
      {shouldRender && (
        <div
          className={`premium-loader-overlay ${isLoading ? 'is-visible' : 'is-leaving'}`}
          aria-hidden={!isLoading}
        >
          <PremiumFullScreenLoader
            compact
            message={message || 'Preparing your workspace'}
            progress={progress}
            className="min-h-0"
          />
        </div>
      )}
    </AnimatePresence>
  );
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [tasks, setTasks] = useState<Record<string, LoadingTask>>({});
  const taskCounter = useRef(0);

  const activeTasks = useMemo(
    () => Object.values(tasks).filter((t) => t.priority !== 'background'),
    [tasks]
  );
  const backgroundTasks = useMemo(
    () => Object.values(tasks).filter((t) => t.priority === 'background'),
    [tasks]
  );

  const criticalTask = activeTasks.find((t) => t.priority === 'critical') ?? activeTasks[0];
  const isLoading = legacyLoading || activeTasks.some((t) => t.priority === 'critical');

  const startTask = useCallback(
    (id: string, options?: { message?: string; priority?: LoadingPriority; progress?: number }) => {
      setTasks((prev) => ({
        ...prev,
        [id]: {
          id,
          message: options?.message,
          priority: options?.priority ?? 'medium',
          progress: options?.progress,
        },
      }));
    },
    []
  );

  const endTask = useCallback((id: string) => {
    setTasks((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const updateTask = useCallback(
    (id: string, patch: Partial<Pick<LoadingTask, 'message' | 'progress'>>) => {
      setTasks((prev) => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id], ...patch } };
      });
    },
    []
  );

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, options?: { message?: string; id?: string }) => {
      const id = options?.id ?? `task-${++taskCounter.current}`;
      startTask(id, { message: options?.message, priority: 'critical' });
      try {
        return await fn();
      } finally {
        endTask(id);
      }
    },
    [startTask, endTask]
  );

  useEffect(() => {
    if (criticalTask?.message) setMessage(criticalTask.message);
    if (criticalTask?.progress !== undefined) setProgress(criticalTask.progress);
  }, [criticalTask]);

  const value = useMemo(
    () => ({
      isLoading,
      setLoading: setLegacyLoading,
      message: criticalTask?.message ?? message,
      setMessage,
      progress: criticalTask?.progress ?? progress,
      setProgress,
      startTask,
      endTask,
      updateTask,
      activeTaskCount: Object.keys(tasks).length,
      withLoading,
    }),
    [
      isLoading,
      message,
      progress,
      criticalTask,
      startTask,
      endTask,
      updateTask,
      tasks,
      withLoading,
    ]
  );

  return (
    <LoadingContext.Provider value={value}>
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      {children}
      <GlobalLoaderOverlay />
      <GlobalLoadingOverlay
        activeCount={backgroundTasks.length}
        message={backgroundTasks[0]?.message ?? 'Syncing in background'}
      />
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

export { LoadingContext };
