'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, AlertTriangle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { SiteTypeBadge } from './site-type-badge';
import { DocumentPreviewCard } from './document-preview-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditCompanySites } from '@/lib/permissions';
import type { CompanySite } from '@/lib/admin/schemas';
import {
  fetchCompanySiteById, fetchCompanySiteAuditTrail, setDefaultCompanySite,
} from '@/lib/admin/company-site-service';

export function CompanySiteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditCompanySites(role);

  const [site, setSite] = useState<CompanySite | null>(null);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultConfirm, setDefaultConfirm] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    try {
      const s = await fetchCompanySiteById(id);
      if (!s) {
        setError('Site not found');
        return;
      }
      setSite(s);
      setAuditTrail(await fetchCompanySiteAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setDefault = async () => {
    if (!site) return;
    const result = await setDefaultCompanySite(id, site, auditMeta);
    if (result.success) {
      toast.success('Default site updated');
      load();
    } else toast.error(result.error || 'Failed');
    setDefaultConfirm(false);
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !site) return <ErrorCard title="Not Found" message={error || 'Site not found'} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/company-site')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Company / Sites
      </Button>

      <PageHeader
        title={site.siteName}
        description={`${site.companyName} · ${site.companyId || site.companyCode}`}
        basePath="/admin"
        actions={
          <div className="flex gap-2">
            {canEdit && !site.isDefault && site.status === 'Active' && (
              <Button variant="outline" size="sm" onClick={() => setDefaultConfirm(true)}>
                <Star className="h-4 w-4 mr-1" />Set Default
              </Button>
            )}
            {canEdit && (
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href={`/admin/company-site/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <StatusBadge status={site.status} />
        <SiteTypeBadge type={site.siteType} />
        {site.isDefault && <Badge className="bg-blue-100 text-blue-800">Default Site</Badge>}
        {site.status === 'Inactive' && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Inactive — new records cannot be created under this site
          </span>
        )}
      </div>

      {site.companyLogo && (
        <Image
          src={site.companyLogo}
          alt="Company logo"
          width={240}
          height={64}
          className="h-16 w-auto rounded border bg-white p-2 object-contain"
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Company & Site Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Company ID', value: site.companyId },
            { label: 'Company Code', value: site.companyCode },
            { label: 'Site Code', value: site.siteCode },
            { label: 'Plant Name', value: site.plantName },
            { label: 'Plant Code', value: site.plantCode },
            { label: 'GST Number', value: site.gstNumber },
            { label: 'Mfg License', value: site.manufacturingLicenseNumber },
            { label: 'Drug License', value: site.drugLicenseNumber },
            { label: 'Contact Person', value: site.contactPerson },
            { label: 'Contact Email', value: site.contactEmail },
            { label: 'Contact Phone', value: site.contactPhone },
            { label: 'Website', value: site.website },
            { label: 'Timezone', value: site.timezone },
            { label: 'Date Format', value: site.dateFormat },
            { label: 'Currency', value: site.defaultCurrency },
            { label: 'Created At', value: site.createdAt ? new Date(site.createdAt).toLocaleString() : '-' },
            { label: 'Updated At', value: site.updatedAt ? new Date(site.updatedAt).toLocaleString() : '-' },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          <div className="sm:col-span-2 md:col-span-3">
            <p className="text-xs text-muted-foreground">Plant Address</p>
            <p className="font-medium">{site.plantAddress}</p>
            <p className="text-sm text-muted-foreground">
              {[site.city, site.state, site.country, site.pinZipCode].filter(Boolean).join(', ')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Document Preview</CardTitle></CardHeader>
        <CardContent>
          <DocumentPreviewCard site={site} />
          <p className="text-xs text-muted-foreground mt-3">
            Used in PQR, CPV, Deviation, OOS, CAPA, Change Control, Stability, Audit, DMS, Training, Validation, and CSV reports.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState message="No audit events for this site." />
          ) : (
            <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {auditTrail.map((l, i) => (
                <div key={i} className="p-2 border rounded">
                  <p className="font-medium">{String(l.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(l.timestamp || l.dateTime)} — {String(l.userName || '')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={defaultConfirm} onOpenChange={setDefaultConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Default Site</AlertDialogTitle>
            <AlertDialogDescription>
              Set &quot;{site.siteName}&quot; as the default site for all document headers?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={setDefault} className="bg-blue-600">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
