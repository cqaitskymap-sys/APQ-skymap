'use client';

import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function toastLoading(message: string, id?: string) {
  return toast.loading(message, { id });
}

export function toastSuccess(message: string, id?: string) {
  return toast.success(message, { id });
}

export function toastError(message: string, id?: string) {
  return toast.error(message, { id });
}

export function toastProgress(message: string, progress: number, id?: string) {
  return toast(message, {
    id,
    icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    description: `${Math.round(progress)}% complete`,
  });
}

export async function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string }
): Promise<T> {
  const id = toast.loading(messages.loading);
  try {
    const result = await promise;
    toast.success(messages.success, { id });
    return result;
  } catch (error) {
    toast.error(messages.error, { id });
    throw error;
  }
}
