'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Download, Filter, Eye, AlertTriangle, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import { mockRecentDeviations } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/loaders/page-loader';

export default function DeviationsPage() {
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deviations, setDeviations] = useState(mockRecentDeviations);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    title: '',
    type: 'major',
    priority: 'medium',
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleAddDeviation = () => {
    if (!formData.number || !formData.title) {
      alert('Please fill required fields');
      return;
    }
    setFormData({ number: '', title: '', type: 'major', priority: 'medium' });
    setOpenDialog(false);
  };

  const filteredDeviations = deviations.filter(d =>
    d.deviation_number.toLowerCase().includes(search.toLowerCase()) ||
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    {
      label: 'Total Deviations',
      value: '67',
      trend: '↓ 12% vs last quarter',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/10',
    },
    {
      label: 'Open',
      value: '12',
      trend: '4 critical',
      icon: TrendingDown,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/10',
    },
    {
      label: 'Under Investigation',
      value: '8',
      trend: 'Avg 4.2 days',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/10',
    },
    {
      label: 'Closed This Year',
      value: '47',
      trend: 'Avg 8.5 days',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/10',
    },
  ];

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deviation Management</h1>
          <p className="text-muted-foreground mt-1">GMP deviations, investigations, and corrective actions</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />Report Deviation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report New Deviation</DialogTitle>
              <DialogDescription>Create a new GMP deviation record</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="number">Deviation Number *</Label>
                <Input
                  id="number"
                  placeholder="DEV-2024-XXX"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Deviation title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="minor">Minor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddDeviation} className="w-full bg-blue-600 hover:bg-blue-700">
                Report Deviation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.bgColor)}>
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{stat.trend}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deviation number, title..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4" />Filter
        </Button>
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <Download className="h-4 w-4" />Export
        </Button>
      </div>

      {/* Deviations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Deviations</CardTitle>
          <CardDescription>Showing {filteredDeviations.length} of {deviations.length} deviations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">Dev. Number</TableHead>
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Detected</TableHead>
                  <TableHead className="text-center font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeviations.length > 0 ? (
                  filteredDeviations.map((dev) => (
                    <TableRow key={dev.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono font-semibold text-sm text-blue-600 dark:text-blue-400">
                        {dev.deviation_number}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{dev.title}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'text-xs font-medium',
                            dev.deviation_type === 'critical'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : dev.deviation_type === 'major'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          )}
                          variant="outline"
                        >
                          {dev.deviation_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'text-xs font-medium',
                            dev.status === 'closed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : dev.status === 'capa_raised'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                : dev.status === 'investigation'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          )}
                          variant="outline"
                        >
                          {dev.status.replace(/_/g, ' ').charAt(0).toUpperCase() + dev.status.replace(/_/g, ' ').slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(dev.detected_date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No deviations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
