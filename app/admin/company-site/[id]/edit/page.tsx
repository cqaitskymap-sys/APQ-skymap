'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CompanySiteAccessGuard } from '@/components/admin/company-sites/company-site-access-guard';
import { CompanySiteForm } from '@/components/admin/company-sites/company-site-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditCompanySites } from '@/lib/permissions';
import {
  fetchCompanySiteById, updateCompanySite, uploadCompanyLogo, updateCompanyLogo,
} from '@/lib/admin/company-site-service';
import type { CompanySiteFormData } from '@/lib/admin/schemas';

function EditCompanySiteContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [initial, setInitial] = useState<CompanySiteFormData | null>(null);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof fetchCompanySiteById>>>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<CompanySiteFormData | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  useEffect(() => {
    fetchCompanySiteById(id).then((s) => {
      if (!s) {
        setLoading(false);
        return;
      }
      setExisting(s);
      setInitial({
        companyName: s.companyName,
        companyCode: s.companyCode || '',
        siteName: s.siteName,
        siteCode: s.siteCode || '',
        siteType: (s.siteType as CompanySiteFormData['siteType']) || 'Manufacturing Plant',
        plantName: s.plantName || '',
        plantCode: s.plantCode || '',
        plantAddress: s.plantAddress || '',
        city: s.city || '',
        state: s.state || '',
        country: s.country || '',
        pinZipCode: s.pinZipCode || '',
        gstNumber: s.gstNumber || s.gstNo || '',
        manufacturingLicenseNumber: s.manufacturingLicenseNumber || s.licenseNo || '',
        drugLicenseNumber: s.drugLicenseNumber || '',
        contactPerson: s.contactPerson || '',
        contactEmail: s.contactEmail || '',
        contactPhone: s.contactPhone || s.contactNumber || '',
        website: s.website || '',
        timezone: s.timezone || s.defaultTimezone || 'Asia/Kolkata',
        dateFormat: (s.dateFormat as CompanySiteFormData['dateFormat']) || 'DD/MM/YYYY',
        timeFormat: (s.timeFormat as CompanySiteFormData['timeFormat']) || '24h',
        defaultCurrency: (s.defaultCurrency as CompanySiteFormData['defaultCurrency']) || 'INR',
        documentHeaderFormat: s.documentHeaderFormat || '',
        documentFooterText: s.documentFooterText || '',
        status: (s.status as CompanySiteFormData['status']) || 'Active',
        isDefault: s.isDefault ?? false,
      });
      setLoading(false);
    });
  }, [id]);

  if (!canEditCompanySites(role)) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can edit company/sites." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!initial || !existing) return <ErrorCard title="Not Found" message="Site not found" />;

  const confirmSave = async (data: CompanySiteFormData) => {
    setSubmitting(true);
    const result = await updateCompanySite(id, data, existing, auditMeta);
    if (result.error) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }

    if (logoFile) {
      const upload = await uploadCompanyLogo(id, logoFile, auditMeta, existing.companyLogo);
      if (upload.url) {
        await updateCompanyLogo(id, upload.url, existing, auditMeta);
      } else if (upload.error) {
        toast.warning(`Saved but logo upload failed: ${upload.error}`);
      }
    }

    setSubmitting(false);
    toast.success('Company/site updated');
    router.push(`/admin/company-site/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Company / Site" description={existing.siteName} basePath="/admin" />
      <CompanySiteForm
        initial={initial}
        existingLogo={existing.companyLogo}
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push(`/admin/company-site/${id}`)}
        onLogoSelect={setLogoFile}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save changes to &quot;{pending?.siteName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-blue-600" onClick={() => pending && confirmSave(pending)}>
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EditCompanySitePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <CompanySiteAccessGuard>
      <EditCompanySiteContent id={params.id} />
    </CompanySiteAccessGuard>
  );
}
