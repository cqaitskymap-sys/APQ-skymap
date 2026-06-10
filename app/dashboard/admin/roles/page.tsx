'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { ADMIN_ROLES, ADMIN_MODULES, PERMISSION_ACTIONS, ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import { getDefaultPermissionMatrix } from '@/lib/permissions';
import { getAdminRecords, createAdminRecord, updateAdminRecord } from '@/lib/admin/admin-service';
import type { PermissionMatrix } from '@/lib/admin/schemas';
import type { AdminModule, PermissionAction } from '@/lib/permissions';

export default function RolesPage() {
  return (
    <AdminAuthGuard requireSuperAdmin>
      <RolesContent />
    </AdminAuthGuard>
  );
}

function RolesContent() {
  const { user, profile } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>(ADMIN_ROLES[0].id);
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [saving, setSaving] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || 'Admin',
    module: 'Admin' as const,
  };

  useEffect(() => {
    async function load() {
      const perms = await getAdminRecords<PermissionMatrix>(ADMIN_COLLECTIONS.permissions);
      const existing = perms.find((p) => p.roleId === selectedRole);
      setMatrix(existing || getDefaultPermissionMatrix(selectedRole as import('@/lib/permissions').AdminRoleId));
    }
    load();
  }, [selectedRole]);

  const togglePermission = (mod: AdminModule, action: PermissionAction) => {
    if (!matrix) return;
    setMatrix({
      ...matrix,
      permissions: {
        ...matrix.permissions,
        [mod]: {
          ...matrix.permissions[mod],
          [action]: !matrix.permissions[mod]?.[action],
        },
      },
    });
  };

  const saveMatrix = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      const data = { ...matrix, roleId: selectedRole, roleName: ADMIN_ROLES.find((r) => r.id === selectedRole)?.name || selectedRole };
      if (matrix.id) {
        await updateAdminRecord(ADMIN_COLLECTIONS.permissions, matrix.id, data, auditMeta);
      } else {
        await createAdminRecord(ADMIN_COLLECTIONS.permissions, data, auditMeta);
      }
      toast.success('Permissions saved');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Role & Permission Management"
        description="Configure role-based access control matrix for all QMS modules"
        actions={
          <Button onClick={saveMatrix} disabled={saving} className="bg-blue-600">
            <Save className="h-4 w-4 mr-2" />Save Permissions
          </Button>
        }
      />

      <Tabs value={selectedRole} onValueChange={setSelectedRole}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 mb-6">
          {ADMIN_ROLES.map((role) => (
            <TabsTrigger key={role.id} value={role.id} className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              {role.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {ADMIN_ROLES.map((role) => (
          <TabsContent key={role.id} value={role.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{role.name} — Permission Matrix</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white dark:bg-slate-900 min-w-[140px]">Module</TableHead>
                      {PERMISSION_ACTIONS.map((action) => (
                        <TableHead key={action} className="text-center text-xs capitalize min-w-[70px]">
                          {action === 'eSign' ? 'e-Sign' : action}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ADMIN_MODULES.map((mod) => (
                      <TableRow key={mod}>
                        <TableCell className="sticky left-0 bg-white dark:bg-slate-900 font-medium text-sm">{mod}</TableCell>
                        {PERMISSION_ACTIONS.map((action) => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={matrix?.permissions?.[mod]?.[action] ?? false}
                              onCheckedChange={() => togglePermission(mod, action)}
                              disabled={role.id === 'super_admin'}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
