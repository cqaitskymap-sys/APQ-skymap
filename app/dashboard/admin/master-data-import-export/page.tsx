'use client';

import { useState } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { MasterCrudPage } from '@/components/admin/master-crud-page';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import { masterDataImportExportSchema } from '@/lib/admin/schemas';
import { StatusBadge } from '@/components/admin/admin-data-table';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';

const MASTER_TYPES = [
  { label: 'Departments', collection: ADMIN_COLLECTIONS.departments },
  { label: 'Designations', collection: ADMIN_COLLECTIONS.designations },
  { label: 'Products', collection: ADMIN_COLLECTIONS.products },
  { label: 'Parameters', collection: ADMIN_COLLECTIONS.parameters },
  { label: 'Company Sites', collection: ADMIN_COLLECTIONS.companySites },
];

export default function MasterDataImportExportPage() {
  const [exportType, setExportType] = useState<string>(MASTER_TYPES[0].collection);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const snap = await getDocs(collection(getFirebaseFirestore(), exportType));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.length} records`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid format');
      toast.success(`Parsed ${data.length} records. Use CRUD log below to track import operations.`);
    } catch {
      toast.error('Import parse failed — ensure valid JSON array');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Master Data Import/Export"
        description="Bulk import and export master data for departments, products, parameters, and more"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" />Export Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={exportType} onValueChange={setExportType}>
              <SelectTrigger><SelectValue placeholder="Select master type" /></SelectTrigger>
              <SelectContent>
                {MASTER_TYPES.map((m) => (
                  <SelectItem key={m.collection} value={m.collection}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={exporting} className="w-full bg-blue-600 hover:bg-blue-700">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export to JSON'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Import Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a JSON array file to validate and preview import data.</p>
            <label className="flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              <span className="text-sm text-muted-foreground">Click to upload JSON file</span>
            </label>
          </CardContent>
        </Card>
      </div>

      <MasterCrudPage
        title="Import/Export Log"
        description="Audit log of master data import and export operations"
        collection={ADMIN_COLLECTIONS.masterDataImportExport}
        module="Admin"
        schema={masterDataImportExportSchema}
        defaultValues={{
          operationId: '', operationType: 'Export', masterType: '',
          fileName: '', recordCount: 0, operationDate: new Date().toISOString(),
          performedBy: '', operationStatus: 'Success', errorLog: '', status: 'Active',
        }}
        uniqueFields={[{ field: 'operationId', label: 'Operation ID' }]}
        fields={[
          { name: 'operationId', label: 'Operation ID', required: true },
          { name: 'operationType', label: 'Type', type: 'select', options: [{ label: 'Import', value: 'Import' }, { label: 'Export', value: 'Export' }] },
          { name: 'masterType', label: 'Master Type', required: true },
          { name: 'fileName', label: 'File Name' },
          { name: 'recordCount', label: 'Record Count', type: 'number' },
          { name: 'operationDate', label: 'Date', type: 'date' },
          { name: 'performedBy', label: 'Performed By' },
          { name: 'operationStatus', label: 'Status', type: 'select', options: [{ label: 'Success', value: 'Success' }, { label: 'Failed', value: 'Failed' }, { label: 'In Progress', value: 'In Progress' }] },
          { name: 'errorLog', label: 'Error Log', type: 'textarea', colSpan: 2 },
          { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }] },
        ]}
        columns={[
          { key: 'operationId', header: 'ID' },
          { key: 'operationType', header: 'Type' },
          { key: 'masterType', header: 'Master' },
          { key: 'recordCount', header: 'Records' },
          { key: 'operationStatus', header: 'Status', render: (r) => <StatusBadge status={r.operationStatus} /> },
          { key: 'operationDate', header: 'Date', render: (r) => r.operationDate ? new Date(r.operationDate).toLocaleString() : '-' },
          { key: 'performedBy', header: 'By' },
        ]}
      />
    </div>
  );
}
