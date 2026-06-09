'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Trash2, CheckCircle } from 'lucide-react';

const mockNotifications = [
  { id: '1', title: 'CAPA Due Date', message: 'CAPA-2024-015 due in 2 days', type: 'warning', module: 'CAPA', read: false, created: '2m ago' },
  { id: '2', title: 'New OOS Raised', message: 'OOS-2024-005 raised for AMK-100 batch', type: 'error', module: 'OOS', read: false, created: '15m ago' },
  { id: '3', title: 'Batch Released', message: 'BTH-2024-005 successfully released', type: 'success', module: 'Batches', read: true, created: '1h ago' },
  { id: '4', title: 'Equipment Alert', message: 'FIL-003 calibration due in 5 days', type: 'info', module: 'Equipment', read: true, created: '3h ago' },
  { id: '5', title: 'Training Due', message: 'GMP training certification expires in 30 days', type: 'warning', module: 'Training', read: true, created: '1d ago' },
];

const getTypeColor = (type: string) => {
  switch (type) {
    case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'warning': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
};

export default function NotificationsPage() {
  const unreadCount = mockNotifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">System alerts and important updates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Mark All as Read</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Notifications</p><p className="text-3xl font-bold">{mockNotifications.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Unread</p><p className="text-3xl font-bold">{unreadCount}</p><p className="text-xs text-red-600 mt-2">Require attention</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Critical</p><p className="text-3xl font-bold">{mockNotifications.filter(n => n.type === 'error').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Warnings</p><p className="text-3xl font-bold">{mockNotifications.filter(n => n.type === 'warning').length}</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {mockNotifications.map(notif => (
          <Card key={notif.id} className={notif.read ? 'opacity-60' : ''}>
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
                      {!notif.read && <Badge variant="default" className="text-xs">New</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{notif.message}</p>
                    <p className="text-xs text-muted-foreground">{notif.created}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notif.read && <Button variant="ghost" size="icon" className="h-8 w-8"><CheckCircle className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
