'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Role-based access control and user permissions</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Invite User</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Users</p><p className="text-3xl font-bold">0</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Active</p><p className="text-3xl font-bold">0</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Last 24h Login</p><p className="text-3xl font-bold">0</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Departments</p><p className="text-3xl font-bold">0</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          No users to display. Invite users or manage them from the admin panel.
        </CardContent>
      </Card>
    </div>
  );
}
