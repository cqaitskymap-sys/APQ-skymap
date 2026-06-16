'use client';

import { DocumentNumberingAccessGuard } from '@/components/admin/document-numbering/document-numbering-access-guard';
import { DocumentNumberingsListPage } from '@/components/admin/document-numbering/document-numberings-list-page';

export default function AdminDocumentNumberingPage() {
  return (
    <DocumentNumberingAccessGuard>
      <DocumentNumberingsListPage />
    </DocumentNumberingAccessGuard>
  );
}
