export type RouteLoaderVariant =
  | 'fullpage'
  | 'dashboard'
  | 'section'
  | 'table'
  | 'form'
  | 'list'
  | 'chart';

export type LoadingPriority = 'critical' | 'medium' | 'small' | 'background';

export interface LoadingTask {
  id: string;
  message?: string;
  priority: LoadingPriority;
  progress?: number;
}
