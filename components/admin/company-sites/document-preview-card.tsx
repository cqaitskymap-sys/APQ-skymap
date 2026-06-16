'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CompanySite } from '@/lib/admin/schemas';
import {
  formatDocumentHeader, formatDocumentFooter, normalizeSite,
} from '@/lib/admin/company-site-service';

export function DocumentPreviewCard({ site, logoUrl }: { site: Partial<CompanySite>; logoUrl?: string }) {
  const merged = normalizeSite(site as CompanySite);
  const header = formatDocumentHeader(merged);
  const footer = formatDocumentFooter(merged);
  const logo = logoUrl || site.companyLogo;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-blue-700">Document Header Preview</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2 bg-slate-50 rounded-b-lg p-4 min-h-[120px]">
          {logo && (
            <img src={logo} alt="Logo" className="h-10 object-contain mb-2" />
          )}
          <pre className="whitespace-pre-wrap font-sans text-slate-800">{header}</pre>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-700">Document Footer Preview</CardTitle>
        </CardHeader>
        <CardContent className="text-xs bg-slate-50 rounded-b-lg p-4 min-h-[120px]">
          <p className="text-slate-600 whitespace-pre-wrap">{footer}</p>
        </CardContent>
      </Card>
    </div>
  );
}
