'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm, FieldValues, DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Eye, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminPageHeader } from './admin-page-header';
import { AdminDataTable, ColumnDef } from './admin-data-table';
import { PermissionGate } from './permission-gate';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord, deleteAdminRecord, checkUniqueField,
} from '@/lib/admin/admin-service';
import type { AdminModule } from '@/lib/permissions';

export interface FormFieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'switch' | 'date';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  colSpan?: 1 | 2;
}

interface MasterCrudPageProps<T extends FieldValues & { id?: string }> {
  title: string;
  description: string;
  collection: string;
  module: AdminModule;
  schema: z.ZodType<T>;
  defaultValues: DefaultValues<T>;
  fields: FormFieldConfig[];
  columns: ColumnDef<T>[];
  uniqueFields?: { field: keyof T & string; label: string }[];
  statusOptions?: string[];
}

export function MasterCrudPage<T extends FieldValues & { id?: string; status?: string }>({
  title,
  description,
  collection,
  module,
  schema,
  defaultValues,
  fields,
  columns,
  uniqueFields = [],
  statusOptions = ['Active', 'Inactive'],
}: MasterCrudPageProps<T>) {
  const { user, profile } = useAuth();
  const { canDelete, isReadOnly } = useAdminPermissions();
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<T | null>(null);
  const [viewing, setViewing] = useState<T | null>(null);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
    module,
  };

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminRecords<T>(collection);
      setRecords(data);
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [collection]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const openCreate = () => {
    setEditing(null);
    form.reset(defaultValues);
    setDrawerOpen(true);
  };

  const openEdit = (record: T) => {
    setEditing(record);
    form.reset(record);
    setDrawerOpen(true);
  };

  const openView = (record: T) => {
    setViewing(record);
    setViewOpen(true);
  };

  const deactivateRecord = async (record: T) => {
    if (!record.id) return;
    try {
      await updateAdminRecord(collection, record.id, { status: 'Inactive' } as Partial<T>, {
        ...auditMeta,
        oldValue: JSON.stringify(record),
      });
      toast.success('Record deactivated');
      loadRecords();
    } catch {
      toast.error('Deactivation failed');
    }
  };

  const onSubmit = async (data: T) => {
    try {
      for (const uf of uniqueFields) {
        const val = String(data[uf.field] ?? '');
        if (val) {
          const unique = await checkUniqueField(collection, uf.field, val, editing?.id);
          if (!unique) {
            form.setError(uf.field as never, { message: `${uf.label} already exists` });
            return;
          }
        }
      }

      if (editing?.id) {
        await updateAdminRecord(collection, editing.id, data as Partial<T>, {
          ...auditMeta,
          oldValue: JSON.stringify(editing),
        });
        toast.success('Record updated successfully');
      } else {
        await createAdminRecord(collection, data as Omit<T, 'id'>, auditMeta);
        toast.success('Record created successfully');
      }
      setDrawerOpen(false);
      loadRecords();
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdminRecord(collection, deleteId, auditMeta);
      toast.success('Record deleted');
      loadRecords();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteId(null);
    }
  };

  const renderField = (field: FormFieldConfig) => {
    const error = form.formState.errors[field.name as keyof T];
    const colClass = field.colSpan === 2 ? 'col-span-2' : '';

    if (field.type === 'textarea') {
      return (
        <div key={field.name} className={`space-y-2 ${colClass}`}>
          <Label>{field.label}{field.required && ' *'}</Label>
          <Textarea {...form.register(field.name as never)} placeholder={field.placeholder} />
          {error && <p className="text-xs text-red-500">{String(error.message)}</p>}
        </div>
      );
    }

    if (field.type === 'switch') {
      return (
        <div key={field.name} className={`flex items-center justify-between ${colClass}`}>
          <Label>{field.label}</Label>
          <Switch
            checked={!!form.watch(field.name as never)}
            onCheckedChange={(v) => form.setValue(field.name as never, v as never)}
          />
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name} className={`space-y-2 ${colClass}`}>
          <Label>{field.label}{field.required && ' *'}</Label>
          <Select
            value={String(form.watch(field.name as never) ?? '')}
            onValueChange={(v) => form.setValue(field.name as never, v as never)}
          >
            <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select...'} /></SelectTrigger>
            <SelectContent>
              {field.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-red-500">{String(error.message)}</p>}
        </div>
      );
    }

    return (
      <div key={field.name} className={`space-y-2 ${colClass}`}>
        <Label>{field.label}{field.required && ' *'}</Label>
        <Input
          type={field.type || 'text'}
          {...form.register(field.name as never, field.type === 'number' ? { valueAsNumber: true } : {})}
          placeholder={field.placeholder}
        />
        {error && <p className="text-xs text-red-500">{String(error.message)}</p>}
      </div>
    );
  };

  return (
    <div>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          !isReadOnly && (
            <PermissionGate module={module} action="create">
              <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />Add New
              </Button>
            </PermissionGate>
          )
        }
      />

      <AdminDataTable
        columns={columns}
        data={records}
        loading={loading}
        searchKeys={fields.filter((f) => f.type !== 'switch').map((f) => f.name as keyof T)}
        statusOptions={statusOptions}
        onRowClick={openView}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openView(row)}>
              <Eye className="h-4 w-4" />
            </Button>
            <PermissionGate module={module} action="edit">
              <Button variant="ghost" size="icon" onClick={() => openEdit(row)} disabled={isReadOnly}>
                <Pencil className="h-4 w-4" />
              </Button>
            </PermissionGate>
            {row.status === 'Active' && !isReadOnly && (
              <PermissionGate module={module} action="edit">
                <Button variant="ghost" size="icon" onClick={() => deactivateRecord(row)} className="text-amber-600">
                  <Ban className="h-4 w-4" />
                </Button>
              </PermissionGate>
            )}
            {canDelete && (
              <PermissionGate module={module} action="delete">
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id!)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Record' : 'Create Record'}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(renderField)}
            </div>
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editing ? 'Update' : 'Create'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Details</SheetTitle>
            <SheetDescription>View-only record information</SheetDescription>
          </SheetHeader>
          {viewing && (
            <div className="mt-6 space-y-3">
              {fields.map((field) => (
                <div key={field.name} className="border-b pb-2">
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="text-sm font-medium mt-0.5">
                    {field.type === 'switch'
                      ? String(!!(viewing as Record<string, unknown>)[field.name])
                      : String((viewing as Record<string, unknown>)[field.name] ?? '-')}
                  </p>
                </div>
              ))}
              {viewing.createdAt && (
                <div className="border-b pb-2">
                  <p className="text-xs text-muted-foreground">Created At</p>
                  <p className="text-sm">{new Date(viewing.createdAt).toLocaleString()}</p>
                </div>
              )}
              {viewing.updatedAt && (
                <div className="border-b pb-2">
                  <p className="text-xs text-muted-foreground">Updated At</p>
                  <p className="text-sm">{new Date(viewing.updatedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The record will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
