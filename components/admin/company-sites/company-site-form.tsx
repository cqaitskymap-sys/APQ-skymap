'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  SITE_TYPES, RECORD_STATUSES, DATE_FORMATS, TIME_FORMATS,
  CURRENCY_OPTIONS, TIMEZONE_OPTIONS, LOGO_MAX_BYTES,
} from '@/lib/admin/constants';
import { companySiteFormSchema, type CompanySiteFormData, type CompanySite } from '@/lib/admin/schemas';
import { validateLogoFile } from '@/lib/admin/company-site-service';
import { DocumentPreviewCard } from './document-preview-card';

interface CompanySiteFormProps {
  initial?: Partial<CompanySiteFormData>;
  existingLogo?: string;
  readOnly?: boolean;
  onSubmit: (data: CompanySiteFormData) => void;
  onCancel: () => void;
  onLogoSelect?: (file: File | null) => void;
  submitting?: boolean;
}

export function CompanySiteForm({
  initial,
  existingLogo,
  readOnly,
  onSubmit,
  onCancel,
  onLogoSelect,
  submitting,
}: CompanySiteFormProps) {
  const [logoPreview, setLogoPreview] = useState(existingLogo || '');
  const [logoError, setLogoError] = useState<string | null>(null);

  const form = useForm<CompanySiteFormData>({
    resolver: zodResolver(companySiteFormSchema),
    defaultValues: {
      companyName: '',
      companyCode: '',
      siteName: '',
      siteCode: '',
      siteType: 'Manufacturing Plant',
      plantName: '',
      plantCode: '',
      plantAddress: '',
      city: '',
      state: '',
      country: 'India',
      pinZipCode: '',
      gstNumber: '',
      manufacturingLicenseNumber: '',
      drugLicenseNumber: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      defaultCurrency: 'INR',
      documentHeaderFormat: '',
      documentFooterText: '',
      status: 'Active',
      isDefault: false,
      ...initial,
    },
  });

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial });
  }, [initial, form]);

  useEffect(() => {
    if (existingLogo) setLogoPreview(existingLogo);
  }, [existingLogo]);

  const watched = form.watch();
  const previewSite: Partial<CompanySite> = {
    ...watched,
    companyLogo: logoPreview,
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateLogoFile(file);
    if (!check.valid) {
      setLogoError(check.error || 'Invalid file');
      return;
    }
    setLogoError(null);
    setLogoPreview(URL.createObjectURL(file));
    onLogoSelect?.(file);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Company & Site Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input {...form.register('companyName')} disabled={readOnly} />
            {form.formState.errors.companyName && <p className="text-xs text-red-500">{form.formState.errors.companyName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Company Code *</Label>
            <Input {...form.register('companyCode')} disabled={readOnly} />
            {form.formState.errors.companyCode && <p className="text-xs text-red-500">{form.formState.errors.companyCode.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Site Name *</Label>
            <Input {...form.register('siteName')} disabled={readOnly} />
            {form.formState.errors.siteName && <p className="text-xs text-red-500">{form.formState.errors.siteName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Site Code *</Label>
            <Input {...form.register('siteCode')} disabled={readOnly} />
            {form.formState.errors.siteCode && <p className="text-xs text-red-500">{form.formState.errors.siteCode.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Site Type</Label>
            <Select
              value={form.watch('siteType')}
              onValueChange={(v) => form.setValue('siteType', v as CompanySiteFormData['siteType'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SITE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Plant Name</Label>
            <Input {...form.register('plantName')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Plant Code</Label>
            <Input {...form.register('plantCode')} disabled={readOnly} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <Image
                  src={logoPreview}
                  alt="Logo"
                  width={180}
                  height={48}
                  className="h-12 w-auto rounded border p-1 object-contain"
                />
              )}
              {!readOnly && (
                <div>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-1" />Upload Logo
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={handleLogo} />
                    </label>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP — max {LOGO_MAX_BYTES / 1024 / 1024} MB</p>
                </div>
              )}
            </div>
            {logoError && <p className="text-xs text-red-500">{logoError}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Address & Licenses</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Plant Address *</Label>
            <Textarea {...form.register('plantAddress')} disabled={readOnly} rows={2} />
            {form.formState.errors.plantAddress && <p className="text-xs text-red-500">{form.formState.errors.plantAddress.message}</p>}
          </div>
          <div className="space-y-2"><Label>City</Label><Input {...form.register('city')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>State</Label><Input {...form.register('state')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>Country</Label><Input {...form.register('country')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>PIN / ZIP Code</Label><Input {...form.register('pinZipCode')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>GST Number</Label><Input {...form.register('gstNumber')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>Manufacturing License</Label><Input {...form.register('manufacturingLicenseNumber')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>Drug License Number</Label><Input {...form.register('drugLicenseNumber')} disabled={readOnly} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact & Regional Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Contact Person</Label><Input {...form.register('contactPerson')} disabled={readOnly} /></div>
          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input type="email" {...form.register('contactEmail')} disabled={readOnly} />
            {form.formState.errors.contactEmail && <p className="text-xs text-red-500">{form.formState.errors.contactEmail.message}</p>}
          </div>
          <div className="space-y-2"><Label>Contact Phone</Label><Input {...form.register('contactPhone')} disabled={readOnly} /></div>
          <div className="space-y-2"><Label>Website</Label><Input {...form.register('website')} disabled={readOnly} /></div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={form.watch('timezone')} onValueChange={(v) => form.setValue('timezone', v)} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={form.watch('dateFormat')} onValueChange={(v) => form.setValue('dateFormat', v as CompanySiteFormData['dateFormat'])} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Time Format</Label>
            <Select value={form.watch('timeFormat')} onValueChange={(v) => form.setValue('timeFormat', v as CompanySiteFormData['timeFormat'])} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_FORMATS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Currency</Label>
            <Select value={form.watch('defaultCurrency')} onValueChange={(v) => form.setValue('defaultCurrency', v as CompanySiteFormData['defaultCurrency'])} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as CompanySiteFormData['status'])} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg sm:col-span-2">
            <Label>Default Site</Label>
            <Switch
              checked={form.watch('isDefault')}
              onCheckedChange={(v) => form.setValue('isDefault', v)}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Document Header & Footer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom Header Format (optional)</Label>
            <Textarea {...form.register('documentHeaderFormat')} disabled={readOnly} rows={3} placeholder="Leave blank to use auto-generated header" />
          </div>
          <div className="space-y-2">
            <Label>Document Footer Text</Label>
            <Textarea {...form.register('documentFooterText')} disabled={readOnly} rows={2} />
          </div>
          <DocumentPreviewCard site={previewSite} logoUrl={logoPreview} />
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end gap-3">
          <button type="button" className="px-4 py-2 border rounded-md text-sm" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save Company / Site'}
          </button>
        </div>
      )}
    </form>
  );
}
