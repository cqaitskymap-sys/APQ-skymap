'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, Package, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/loaders/page-loader';
import type { CompositionRow, BrandNameRow } from '@/lib/pqr-schemas';

interface Product {
  id: string;
  generic_name: string;
  product_name: string;
  strength: string;
  shelf_life: string;
  standard_batch_size: string;
  manufacturing_license_no: string;
  final_packing_details: string;
  product_code: string;
  dosage_form: string;
  market_type: string;
}

const defaultComposition: CompositionRow = { ingredient_name: '', grade: '', equivalent_claim: '', quantity: '', unit: '', purpose: '', sort_order: 0 };

export default function ProductMasterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ generic_name: '', product_name: '', strength: '', shelf_life: '', standard_batch_size: '', manufacturing_license_no: '', final_packing_details: '', product_code: '', dosage_form: '', market_type: '' });
  const [compositions, setCompositions] = useState<CompositionRow[]>([{ ...defaultComposition }]);
  const [brandNames, setBrandNames] = useState<BrandNameRow[]>([{ brand_name: '' }]);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('product_master').select('*').order('product_name');
    if (data) setProducts(data as Product[]);
    setIsLoading(false);
  };

  if (isLoading) return <PageLoader />;

  const filtered = products.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    p.generic_name.toLowerCase().includes(search.toLowerCase()) ||
    p.product_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (editingId) {
      const { error } = await supabase.from('product_master').update(form).eq('id', editingId);
      if (error) return;
      // Delete and re-insert composition and brands
      await supabase.from('pqr_composition').delete().eq('product_id', editingId);
      await supabase.from('pqr_brand_names').delete().eq('product_id', editingId);
      if (compositions.filter(c => c.ingredient_name).length > 0) {
        await supabase.from('pqr_composition').insert(compositions.filter(c => c.ingredient_name).map((c, i) => ({ product_id: editingId, ...c, sort_order: i })));
      }
      if (brandNames.filter(b => b.brand_name.trim()).length > 0) {
        await supabase.from('pqr_brand_names').insert(brandNames.filter(b => b.brand_name.trim()).map(b => ({ product_id: editingId, brand_name: b.brand_name })));
      }
    } else {
      const { data, error } = await supabase.from('product_master').insert(form).select().maybeSingle();
      if (error || !data) return;
      const pid = data.id;
      if (compositions.filter(c => c.ingredient_name).length > 0) {
        await supabase.from('pqr_composition').insert(compositions.filter(c => c.ingredient_name).map((c, i) => ({ product_id: pid, ...c, sort_order: i })));
      }
      if (brandNames.filter(b => b.brand_name.trim()).length > 0) {
        await supabase.from('pqr_brand_names').insert(brandNames.filter(b => b.brand_name.trim()).map(b => ({ product_id: pid, brand_name: b.brand_name })));
      }
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm({ generic_name: '', product_name: '', strength: '', shelf_life: '', standard_batch_size: '', manufacturing_license_no: '', final_packing_details: '', product_code: '', dosage_form: '', market_type: '' });
    setCompositions([{ ...defaultComposition }]);
    setBrandNames([{ brand_name: '' }]);
    fetchProducts();
  };

  const openEdit = async (p: Product) => {
    setEditingId(p.id);
    setForm({
      generic_name: p.generic_name, product_name: p.product_name, strength: p.strength,
      shelf_life: p.shelf_life, standard_batch_size: p.standard_batch_size,
      manufacturing_license_no: p.manufacturing_license_no, final_packing_details: p.final_packing_details,
      product_code: p.product_code, dosage_form: p.dosage_form, market_type: p.market_type,
    });
    const { data: comp } = await supabase.from('pqr_composition').select('*').eq('product_id', p.id).order('sort_order');
    setCompositions(comp?.length ? comp as any : [{ ...defaultComposition }]);
    const { data: brands } = await supabase.from('pqr_brand_names').select('*').eq('product_id', p.id);
    setBrandNames(brands?.length ? brands as any : [{ brand_name: '' }]);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('pqr_composition').delete().eq('product_id', id);
    await supabase.from('pqr_brand_names').delete().eq('product_id', id);
    await supabase.from('product_master').delete().eq('id', id);
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Master</h1>
          <p className="text-muted-foreground">Manage product details, composition, and brand names</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 gap-2" onClick={() => { setEditingId(null); setForm({ generic_name: '', product_name: '', strength: '', shelf_life: '', standard_batch_size: '', manufacturing_license_no: '', final_packing_details: '', product_code: '', dosage_form: '', market_type: '' }); setCompositions([{ ...defaultComposition }]); setBrandNames([{ brand_name: '' }]); }}>
              <Plus className="h-4 w-4" />Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? 'Edit Product' : 'Add New Product'}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Generic Name *</Label><Input className="mt-1" value={form.generic_name} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))} /></div>
                <div><Label>Product Name *</Label><Input className="mt-1" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} /></div>
                <div><Label>Strength *</Label><Input className="mt-1" value={form.strength} onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} /></div>
                <div><Label>Shelf Life</Label><Input className="mt-1" value={form.shelf_life} onChange={e => setForm(f => ({ ...f, shelf_life: e.target.value }))} /></div>
                <div><Label>Batch Size</Label><Input className="mt-1" value={form.standard_batch_size} onChange={e => setForm(f => ({ ...f, standard_batch_size: e.target.value }))} /></div>
                <div><Label>Mfg License No.</Label><Input className="mt-1" value={form.manufacturing_license_no} onChange={e => setForm(f => ({ ...f, manufacturing_license_no: e.target.value }))} /></div>
                <div><Label>Product Code</Label><Input className="mt-1 font-mono" value={form.product_code} onChange={e => setForm(f => ({ ...f, product_code: e.target.value }))} /></div>
                <div><Label>Dosage Form</Label>
                  <Select value={form.dosage_form} onValueChange={v => setForm(f => ({ ...f, dosage_form: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Injection">Injection</SelectItem>
                      <SelectItem value="Tablet">Tablet</SelectItem>
                      <SelectItem value="Capsule">Capsule</SelectItem>
                      <SelectItem value="Syrup">Syrup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Market Type</Label>
                  <Select value={form.market_type} onValueChange={v => setForm(f => ({ ...f, market_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Domestic">Domestic</SelectItem>
                      <SelectItem value="Export">Export</SelectItem>
                      <SelectItem value="Both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-semibold">Composition</Label>
                  <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => setCompositions(c => [...c, { ...defaultComposition, sort_order: c.length }])}><Plus className="h-3 w-3" />Row</Button>
                </div>
                <div className="space-y-2">
                  {compositions.map((c, i) => (
                    <div key={i} className="grid grid-cols-7 gap-2">
                      <Input className="h-8 text-xs" placeholder="Ingredient" value={c.ingredient_name} onChange={e => setCompositions(co => co.map((x, j) => j === i ? { ...x, ingredient_name: e.target.value } : x))} />
                      <Input className="h-8 text-xs" placeholder="Grade" value={c.grade} onChange={e => setCompositions(co => co.map((x, j) => j === i ? { ...x, grade: e.target.value } : x))} />
                      <Input className="h-8 text-xs" placeholder="Eq. Claim" value={c.equivalent_claim} onChange={e => setCompositions(co => co.map((x, j) => j === i ? { ...x, equivalent_claim: e.target.value } : x))} />
                      <Input className="h-8 text-xs" placeholder="Qty" value={c.quantity} onChange={e => setCompositions(co => co.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                      <Input className="h-8 text-xs" placeholder="Unit" value={c.unit} onChange={e => setCompositions(co => co.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                      <Input className="h-8 text-xs" placeholder="Purpose" value={c.purpose} onChange={e => setCompositions(co => co.map((x, j) => j === i ? { ...x, purpose: e.target.value } : x))} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setCompositions(co => co.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-semibold">Brand Names</Label>
                  <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => setBrandNames(b => [...b, { brand_name: '' }])}><Plus className="h-3 w-3" />Brand</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandNames.map((b, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input className="h-8 text-xs w-32" value={b.brand_name} onChange={e => setBrandNames(br => br.map((x, j) => j === i ? { brand_name: e.target.value } : x))} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setBrandNames(br => br.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-500" onClick={handleSave}>
                {editingId ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-blue-600" />
                    <h3 className="font-semibold">{p.product_name}</h3>
                    <Badge variant="outline" className="text-xs">{p.strength}</Badge>
                    {p.product_code && <Badge variant="outline" className="text-xs font-mono">{p.product_code}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{p.generic_name} | {p.dosage_form} | {p.market_type}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(p)}><Edit className="h-3.5 w-3.5" />Edit</Button>
                  <Button variant="outline" size="sm" className="gap-1 text-red-600" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
