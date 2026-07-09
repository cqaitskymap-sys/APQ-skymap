'use client';

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { importProductsFromFile, importProductsFromText } from '@/lib/admin/product-service';
import type { ProductAuditMeta } from '@/lib/admin/product-service';

interface ProductBulkImportProps {
  auditMeta: ProductAuditMeta;
  onImported?: () => void;
}

export function ProductBulkImport({ auditMeta, onImported }: ProductBulkImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);

  const runImport = async (text: string) => {
    if (!text.trim()) {
      toast.error('Paste product list or choose a file first');
      return;
    }
    setImporting(true);
    try {
      const result = await importProductsFromText(text, auditMeta);
      if (result.imported) toast.success(`Imported ${result.imported} product(s)`);
      if (result.errors.length) toast.warning(`${result.errors.length} row(s) failed to import`);
      if (!result.imported && !result.errors.length) toast.error('No valid product rows found');
      if (result.imported) {
        setPasteText('');
        onImported?.();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importProductsFromFile(file, auditMeta);
      if (result.imported) toast.success(`Imported ${result.imported} product(s)`);
      if (result.errors.length) toast.warning(`${result.errors.length} row(s) failed to import`);
      if (!result.imported && !result.errors.length) toast.error('No valid product rows found');
      if (result.imported) onImported?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const loadSeedFile = async () => {
    setImporting(true);
    try {
      const res = await fetch('/data/skymap-products-import.tsv');
      if (!res.ok) throw new Error('Seed file not found');
      await runImport(await res.text());
    } catch (e) {
      toast.error((e as Error).message);
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk Import Products</CardTitle>
        <CardDescription>
          Upload Product Name, Product Code, MFR No., and BPR No. Strength values like 1 ML / 2 ML are auto-extracted from product name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload File
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={importing} onClick={loadSeedFile}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Import Skymap List
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>

        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={'Paste tab-separated rows:\nProduct Name\tProduct Code\tMFR No.\tBPR No.'}
          rows={5}
          disabled={importing}
        />

        <Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={importing} onClick={() => runImport(pasteText)}>
          {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Import Pasted Rows
        </Button>
      </CardContent>
    </Card>
  );
}
