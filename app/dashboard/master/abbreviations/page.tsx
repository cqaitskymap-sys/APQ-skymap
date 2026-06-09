'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, BookOpen, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/loaders/page-loader';

interface Abbr {
  id: string;
  abbreviation: string;
  full_form: string;
  description: string;
  is_active: boolean;
}

export default function AbbreviationMasterPage() {
  const [abbreviations, setAbbreviations] = useState<Abbr[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ abbreviation: '', full_form: '', description: '', is_active: true });

  useEffect(() => { fetchAbbreviations(); }, []);

  const fetchAbbreviations = async () => {
    const { data } = await supabase.from('abbreviation_master').select('*').order('abbreviation');
    if (data) setAbbreviations(data as Abbr[]);
    setIsLoading(false);
  };

  if (isLoading) return <PageLoader />;

  const filtered = abbreviations.filter(a =>
    a.abbreviation.toLowerCase().includes(search.toLowerCase()) ||
    a.full_form.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (editingId) {
      await supabase.from('abbreviation_master').update(form).eq('id', editingId);
    } else {
      await supabase.from('abbreviation_master').insert(form);
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm({ abbreviation: '', full_form: '', description: '', is_active: true });
    fetchAbbreviations();
  };

  const openEdit = (a: Abbr) => {
    setEditingId(a.id);
    setForm({ abbreviation: a.abbreviation, full_form: a.full_form, description: a.description, is_active: a.is_active });
    setDialogOpen(true);
  };

  const toggleActive = async (a: Abbr) => {
    await supabase.from('abbreviation_master').update({ is_active: !a.is_active }).eq('id', a.id);
    fetchAbbreviations();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('abbreviation_master').delete().eq('id', id);
    fetchAbbreviations();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Abbreviation Master</h1>
          <p className="text-muted-foreground">Manage standard abbreviations used in PQR documents</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 gap-2" onClick={() => { setEditingId(null); setForm({ abbreviation: '', full_form: '', description: '', is_active: true }); }}>
              <Plus className="h-4 w-4" />Add Abbreviation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Edit Abbreviation' : 'Add Abbreviation'}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Abbreviation *</Label><Input className="mt-1 font-mono" value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} /></div>
              <div><Label>Full Form *</Label><Input className="mt-1" value={form.full_form} onChange={e => setForm(f => ({ ...f, full_form: e.target.value }))} /></div>
              <div><Label>Description</Label><Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button className="w-full bg-blue-600 hover:bg-blue-500" onClick={handleSave}>{editingId ? 'Update' : 'Add'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total</p><p className="text-3xl font-bold">{abbreviations.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Active</p><p className="text-3xl font-bold text-green-600">{abbreviations.filter(a => a.is_active).length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Inactive</p><p className="text-3xl font-bold text-gray-600">{abbreviations.filter(a => !a.is_active).length}</p></CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search abbreviations..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Abbreviation</th>
                  <th className="px-6 py-3 text-left font-semibold">Full Form</th>
                  <th className="px-6 py-3 text-left font-semibold">Description</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b hover:bg-muted/50">
                    <td className="px-6 py-3 font-mono font-semibold">{a.abbreviation}</td>
                    <td className="px-6 py-3">{a.full_form}</td>
                    <td className="px-6 py-3 text-muted-foreground">{a.description}</td>
                    <td className="px-6 py-3">
                      <Badge variant={a.is_active ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => toggleActive(a)}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No abbreviations match your search</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
