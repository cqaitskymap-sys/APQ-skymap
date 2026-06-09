'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Download } from 'lucide-react';

const mockDocuments = [
  { id: '1', doc_number: 'SOP-2024-001', title: 'SOP for Batch Manufacturing', type: 'sop', version: '3.0', status: 'approved', effective_date: '2024-01-01' },
  { id: '2', doc_number: 'POLICY-2024-002', title: 'Quality Management Policy', type: 'policy', version: '2.1', status: 'approved', effective_date: '2024-01-15' },
  { id: '3', doc_number: 'SPEC-2024-003', title: 'Product Specification - Amikacin', type: 'specification', version: '1.5', status: 'approved', effective_date: '2023-06-01' },
  { id: '4', doc_number: 'FORM-2024-004', title: 'Batch Record Template', type: 'form', version: '2.0', status: 'draft', effective_date: null },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Management</h1>
          <p className="text-muted-foreground">SOPs, policies, specifications, and forms</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Upload Document</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Documents</p><p className="text-3xl font-bold">{mockDocuments.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Active</p><p className="text-3xl font-bold">{mockDocuments.filter(d => d.status === 'approved').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">SOPs</p><p className="text-3xl font-bold">{mockDocuments.filter(d => d.type === 'sop').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Under Review</p><p className="text-3xl font-bold">{mockDocuments.filter(d => d.status === 'draft').length}</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {mockDocuments.map(doc => (
          <Card key={doc.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-mono text-sm">{doc.doc_number}</p>
                    <h3 className="font-semibold">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground">v{doc.version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{doc.type}</Badge>
                  <Badge variant={doc.status === 'approved' ? 'default' : 'outline'}>{doc.status}</Badge>
                  <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
