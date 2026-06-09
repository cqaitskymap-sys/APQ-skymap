'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Lock } from 'lucide-react';

const mockUsers = [
  { id: '1', name: 'Dr. Sarah Johnson', email: 'sarah@pharmaQMS.com', role: 'qa', department: 'Quality Assurance', is_active: true, last_login: '2024-01-24' },
  { id: '2', name: 'Dr. John Smith', email: 'john@pharmaQMS.com', role: 'qc', department: 'Quality Control', is_active: true, last_login: '2024-01-24' },
  { id: '3', name: 'Mike Wilson', email: 'mike@pharmaQMS.com', role: 'production', department: 'Production', is_active: true, last_login: '2024-01-23' },
  { id: '4', name: 'Emma Davis', email: 'emma@pharmaQMS.com', role: 'regulatory', department: 'Regulatory Affairs', is_active: true, last_login: '2024-01-22' },
];

const getRoleColor = (role: string) => {
  const colors: { [key: string]: string } = {
    super_admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    qa: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    qc: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    production: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    regulatory: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
};

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
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Users</p><p className="text-3xl font-bold">{mockUsers.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Active</p><p className="text-3xl font-bold">{mockUsers.filter(u => u.is_active).length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Last 24h Login</p><p className="text-3xl font-bold">3</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Departments</p><p className="text-3xl font-bold">{new Set(mockUsers.map(u => u.department)).size}</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {mockUsers.map(user => (
          <Card key={user.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{user.name}</h3>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" variant="outline">Active</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>
                    <span>{user.department}</span>
                    <span>Last login: {new Date(user.last_login).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getRoleColor(user.role)} variant="outline">{user.role.replace('_', ' ')}</Badge>
                  <Button variant="outline" size="sm"><Lock className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
