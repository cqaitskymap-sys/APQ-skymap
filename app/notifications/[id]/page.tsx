'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import {
  getNotificationActionLink, getNotificationById, markNotificationAsRead,
  type NotificationRecord,
} from '@/lib/notification-service';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { PriorityBadge } from '@/components/admin/notifications/priority-badge';

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const id = params.id as string;
  const [notification, setNotification] = useState<NotificationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await getNotificationById(id);
      if (!record) {
        setError('Notification not found');
        return;
      }
      const canRead = record.userId === user?.uid
        || (Boolean(record.recipientRole) && record.recipientRole === profile?.role)
        || ['super_admin', 'admin'].includes(profile?.role || '');
      if (!canRead) {
        setError('You do not have access to this notification');
        return;
      }
      const isReadForUser = record.recipientRole && user
        ? record.readBy?.includes(user.uid) || false
        : record.isRead;
      setNotification({
        ...record,
        isRead: isReadForUser,
        readStatus: isReadForUser ? 'Read' : 'Unread',
        readAt: record.recipientRole && user ? record.readAtBy?.[user.uid] || null : record.readAt,
      });
      if (!isReadForUser && record.id && user) {
        const marked = await markNotificationAsRead(record.id, {
          id: user.uid,
          name: profile?.full_name || profile?.email || 'User',
        });
        if (marked) {
          setNotification((current) => current
            ? { ...current, isRead: true, readStatus: 'Read', readAt: new Date().toISOString() }
            : current);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, profile?.email, profile?.full_name, profile?.role, user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !notification) return <ErrorCard message={error || 'Not found'} onRetry={load} />;
  const relatedRoute = getNotificationActionLink(notification);

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="outline" size="sm" asChild>
        <Link href="/notifications"><ArrowLeft className="h-4 w-4 mr-1" />Back to notifications</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="outline">{notification.moduleName}</Badge>
            <PriorityBadge priority={notification.priority} />
            <Badge variant="outline">{notification.readStatus || (notification.isRead ? 'Read' : 'Unread')}</Badge>
            <Badge variant="outline">{notification.sentStatus || 'Sent'}</Badge>
          </div>
          <CardTitle>{notification.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground whitespace-pre-wrap">{notification.message}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-muted-foreground">Record ID</span><span className="font-mono">{notification.recordId}</span>
            <span className="text-muted-foreground">Document</span><span>{notification.documentNumber || '—'}</span>
            <span className="text-muted-foreground">Event</span><span>{notification.eventName || '—'}</span>
            <span className="text-muted-foreground">Created</span>
            <span>{notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : '—'}</span>
          </div>
          {relatedRoute !== `/notifications/${encodeURIComponent(id)}` && (
            <Button
              className="bg-sky-600 hover:bg-sky-700"
              onClick={() => router.push(relatedRoute)}
            >
              Open Related Record
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
