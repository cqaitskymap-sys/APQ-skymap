'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/lib/notifications';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const getTypeColor = (type: string) => {
  switch (type) {
    case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'warning': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'approval': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured()) {
      setLoading(false);
      setError('Firebase is not configured. Add credentials to .env.local to load notifications.');
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (data) => {
        setNotifications(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    const ok = await markNotificationRead(id);
    if (ok) toast.success('Notification marked as read');
    else toast.error('Failed to update notification');
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    const ok = await markAllNotificationsRead(user.uid);
    if (ok) toast.success('All notifications marked as read');
    else toast.error('Failed to update notifications');
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Loading notifications..." />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Real-time system alerts and approval updates</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>Mark All as Read</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total</p><p className="text-3xl font-bold">{notifications.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Unread</p><p className="text-3xl font-bold">{unreadCount}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Critical</p><p className="text-3xl font-bold">{notifications.filter((n) => n.type === 'error').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Approvals</p><p className="text-3xl font-bold">{notifications.filter((n) => n.type === 'approval').length}</p></CardContent></Card>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You are all caught up. New alerts and approval requests will appear here in real time."
          icon={Bell}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card key={notif.id} className={notif.isRead ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 flex items-start gap-3">
                    <Bell className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{notif.title}</h3>
                        <Badge className={`${getTypeColor(notif.type)} text-xs`} variant="outline">
                          {notif.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{notif.moduleName}</Badge>
                        {!notif.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{notif.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {notif.createdAt
                          ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })
                          : 'Just now'}
                      </p>
                    </div>
                  </div>
                  {!notif.isRead && notif.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMarkRead(notif.id!)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
