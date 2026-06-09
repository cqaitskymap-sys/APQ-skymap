'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Download, Filter, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const mockComplaints = [
  { id: '1', complaint_number: 'CPLAINT-2024-005', product: 'Amikacin 100mg', batch: 'BTH-2024-045', customer: 'City Hospital', severity: 'major', status: 'under_investigation', source: 'customer', reported_date: '2024-01-23', assigned_to: 'Dr. Sarah' },
  { id: '2', complaint_number: 'CPLAINT-2024-004', product: 'Meropenem 500mg', batch: 'BTH-2024-043', customer: 'State Medical Institute', severity: 'critical', status: 'closed', source: 'customer', reported_date: '2024-01-20', assigned_to: 'Dr. John' },
  { id: '3', complaint_number: 'CPLAINT-2024-003', product: 'Vancomycin 500mg', batch: 'BTH-2024-042', customer: 'Private Clinic', severity: 'minor', status: 'closed', source: 'distributor', reported_date: '2024-01-18', assigned_to: 'Dr. Mike' },
  { id: '4', complaint_number: 'CPLAINT-2024-002', product: 'Ceftriaxone 1g', batch: 'BTH-2024-040', customer: 'Corporate Hospital', severity: 'reportable', status: 'regulatory_reported', source: 'customer', reported_date: '2024-01-15', assigned_to: 'Dr. Emma' },
];

export default function ComplaintsPage() {
  const [search, setSearch] = useState('');
  const [complaints, setComplaints] = useState(mockComplaints);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({ product: '', customer: '', severity: 'minor', description: '' });

  const handleAddComplaint = () => {
    const newComplaint = {
      id: Date.now().toString(),
      complaint_number: `CPLAINT-2024-${complaints.length + 1}`,
      product: formData.product,
      batch: 'TBD',
      customer: formData.customer,
      severity: formData.severity,
      status: 'open',
      source: 'customer',
      reported_date: new Date().toISOString().split('T')[0],
      assigned_to: 'Unassigned',
    };
    setComplaints([newComplaint, ...complaints]);
    setFormData({ product: '', customer: '', severity: 'minor', description: '' });
    setOpenDialog(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'major': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'reportable': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'under_investigation': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'closed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'regulatory_reported': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const filteredComplaints = complaints.filter(c =>
    c.complaint_number.toLowerCase().includes(search.toLowerCase()) ||
    c.product.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Complaint Management</h1>
          <p className="text-muted-foreground">Customer complaints, investigations, and regulatory reporting</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Register Complaint</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Register Customer Complaint</DialogTitle>
              <DialogDescription>Log a new product complaint for investigation</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Input placeholder="Product name" value={formData.product} onChange={e => setFormData({...formData, product: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input placeholder="Hospital / Clinic name" value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={val => setFormData({...formData, severity: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="reportable">Reportable (Regulatory)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Complaint Description</Label>
                <Textarea placeholder="Describe the complaint in detail..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="h-24" />
              </div>
              <Button onClick={handleAddComplaint} className="w-full bg-blue-600 hover:bg-blue-500">Register Complaint</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Complaints</p>
            <p className="text-3xl font-bold">{complaints.length}</p>
            <p className="text-xs text-blue-600 mt-2">YTD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Open</p>
            <p className="text-3xl font-bold">{complaints.filter(c => c.status === 'open').length}</p>
            <p className="text-xs text-amber-600 mt-2">Pending investigation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Regulatory Reports</p>
            <p className="text-3xl font-bold">{complaints.filter(c => c.status === 'regulatory_reported').length}</p>
            <p className="text-xs text-red-600 mt-2">Critical + Reportable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Avg Resolution Time</p>
            <p className="text-3xl font-bold">8.2</p>
            <p className="text-xs text-green-600 mt-2">days</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search complaint number or product..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      <div className="space-y-3">
        {filteredComplaints.map((complaint) => (
          <Card key={complaint.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-mono font-semibold text-sm">{complaint.complaint_number}</p>
                    {complaint.severity === 'reportable' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                  </div>
                  <h3 className="font-semibold text-base mb-1">{complaint.product}</h3>
                  <p className="text-sm text-muted-foreground">From {complaint.customer}</p>
                </div>
                <div className="flex gap-2 flex-col">
                  <Badge className={`${getSeverityColor(complaint.severity)} text-xs`} variant="outline">
                    {complaint.severity}
                  </Badge>
                  <Badge className={`${getStatusColor(complaint.status)} text-xs`} variant="outline">
                    {complaint.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t text-xs">
                <div>
                  <p className="text-muted-foreground">Reported</p>
                  <p className="font-medium">{new Date(complaint.reported_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Batch</p>
                  <p className="font-medium font-mono">{complaint.batch}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{complaint.assigned_to}</p>
                </div>
                <div>
                  <Button variant="outline" size="sm" className="w-full">View & Investigate</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
