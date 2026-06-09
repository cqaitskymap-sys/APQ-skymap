'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Download, Filter, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/loaders/page-loader';

const mockCAPAs = [
  { id: '1', capa_number: 'CAPA-2024-015', title: 'Temperature excursion in cold storage', status: 'in_progress', priority: 'high', target_date: '2024-02-15', days_open: 12 },
  { id: '2', capa_number: 'CAPA-2024-014', title: 'Reduce particulate contamination', status: 'verification', priority: 'high', target_date: '2024-02-10', days_open: 18 },
  { id: '3', capa_number: 'CAPA-2024-013', title: 'Improve label adhesion process', status: 'effective', priority: 'medium', target_date: '2024-01-30', days_open: 28 },
  { id: '4', capa_number: 'CAPA-2024-012', title: 'Enhanced training for QA team', status: 'closed', priority: 'medium', target_date: '2024-01-25', days_open: 35 },
];

export default function CAPAPage() {
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'in_progress': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'verification': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'effective': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CAPA Management</h1>
          <p className="text-muted-foreground">Corrective and Preventive Actions</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Raise CAPA</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total CAPAs</p>
            <p className="text-3xl font-bold">118</p>
            <p className="text-xs text-green-600 mt-2">↓ 8% vs last year</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Open</p>
            <p className="text-3xl font-bold">18</p>
            <p className="text-xs text-amber-600 mt-2">Avg 14.2 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Under Verification</p>
            <p className="text-3xl font-bold">6</p>
            <p className="text-xs text-blue-600 mt-2">Effectiveness check</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Effective</p>
            <p className="text-3xl font-bold">94</p>
            <p className="text-xs text-green-600 mt-2">79.7% effectiveness</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search CAPA number, title..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      <div className="grid gap-4">
        {mockCAPAs.map((capa) => (
          <Card key={capa.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono font-semibold text-sm mb-1">{capa.capa_number}</p>
                  <h3 className="font-semibold text-sm">{capa.title}</h3>
                </div>
                <div className="flex gap-2">
                  <Badge className={getPriorityColor(capa.priority)} variant="outline">{capa.priority}</Badge>
                  <Badge className={getStatusColor(capa.status)} variant="outline">{capa.status.replace('_', ' ')}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Target: {new Date(capa.target_date).toLocaleDateString()}</span>
                <span>Days Open: {capa.days_open}</span>
                <Button variant="ghost" size="sm" className="h-8 ml-auto">
                  <Eye className="h-4 w-4 mr-2" />View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
