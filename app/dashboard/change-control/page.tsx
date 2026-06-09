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
import { Plus, Search, Download, Filter, Eye, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const mockChangeControls = [
  { id: '1', cc_number: 'CC-2024-045', title: 'Update filling machine parameters', status: 'approved', type: 'minor', priority: 'medium', requested_by: 'John Doe', target_date: '2024-02-15', approval_date: '2024-01-25' },
  { id: '2', cc_number: 'CC-2024-044', title: 'Replace autoclave with new model', status: 'under_review', type: 'major', priority: 'high', requested_by: 'Jane Smith', target_date: '2024-03-01', approval_date: null },
  { id: '3', cc_number: 'CC-2024-043', title: 'Update QC testing procedure', status: 'approved', type: 'minor', priority: 'low', requested_by: 'Mike Wilson', target_date: '2024-02-10', approval_date: '2024-01-22' },
  { id: '4', cc_number: 'CC-2024-042', title: 'Emergency fix - cooling system failure', status: 'implemented', type: 'emergency', priority: 'critical', requested_by: 'Sarah Johnson', target_date: '2024-01-24', approval_date: '2024-01-24' },
];

export default function ChangeControlPage() {
  const [search, setSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [changes, setChanges] = useState(mockChangeControls);
  const [formData, setFormData] = useState({ title: '', type: 'minor', priority: 'medium', justification: '' });

  const handleAddCC = () => {
    const newCC = {
      id: Date.now().toString(),
      cc_number: `CC-2024-${Math.floor(Math.random() * 1000)}`,
      title: formData.title,
      status: 'draft',
      type: formData.type,
      priority: formData.priority,
      requested_by: 'Current User',
      target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      approval_date: null,
    };
    setChanges([newCC, ...changes]);
    setFormData({ title: '', type: 'minor', priority: 'medium', justification: '' });
    setOpenDialog(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'submitted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'under_review': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'implemented': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'minor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'major': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'emergency': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const filteredChanges = changes.filter(c =>
    c.cc_number.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change Control Management</h1>
          <p className="text-muted-foreground">Request and manage operational changes with approval workflow</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Request Change</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Request Change Control</DialogTitle>
              <DialogDescription>Submit a new change for review and approval</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Change Title</Label>
                <Input placeholder="Describe the change..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Change Type</Label>
                  <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={val => setFormData({...formData, priority: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Justification</Label>
                <Textarea placeholder="Why is this change needed?" value={formData.justification} onChange={e => setFormData({...formData, justification: e.target.value})} className="h-24" />
              </div>
              <Button onClick={handleAddCC} className="w-full bg-blue-600 hover:bg-blue-500">Submit Request</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total CCs</p>
            <p className="text-3xl font-bold">{changes.length}</p>
            <p className="text-xs text-blue-600 mt-2">YTD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Under Review</p>
            <p className="text-3xl font-bold">{changes.filter(c => c.status === 'under_review').length}</p>
            <p className="text-xs text-amber-600 mt-2">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Approved</p>
            <p className="text-3xl font-bold">{changes.filter(c => c.status === 'approved').length}</p>
            <p className="text-xs text-green-600 mt-2">Ready to implement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Implemented</p>
            <p className="text-3xl font-bold">{changes.filter(c => c.status === 'implemented').length}</p>
            <p className="text-xs text-emerald-600 mt-2">Completed</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search CC number or title..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      <div className="space-y-3">
        {filteredChanges.map((cc) => (
          <Card key={cc.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-mono font-semibold text-sm">{cc.cc_number}</p>
                    <Badge className={`${getStatusColor(cc.status)} text-xs`} variant="outline">
                      {cc.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={`${getTypeColor(cc.type)} text-xs`} variant="outline">
                      {cc.type}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base mb-1">{cc.title}</h3>
                  <p className="text-sm text-muted-foreground">Requested by {cc.requested_by}</p>
                </div>
                <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-2" />View</Button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Target Date</p>
                  <p className="text-sm font-medium">{new Date(cc.target_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <p className="text-sm font-medium capitalize">{cc.priority}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {cc.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {cc.status === 'under_review' && <Clock className="h-4 w-4 text-amber-600" />}
                    {cc.status === 'implemented' && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                    <span className="text-sm">{cc.approval_date ? 'Approved' : 'Pending'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
