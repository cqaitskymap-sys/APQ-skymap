'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Download, Filter, Eye, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/loaders/page-loader';

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  formulation: string;
  strength: string;
  is_active: boolean;
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', formulation: '', strength: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  const handleAddProduct = () => {
    const newProduct = {
      id: Date.now().toString(),
      product_code: formData.code,
      product_name: formData.name,
      formulation: formData.formulation,
      strength: formData.strength,
      is_active: true,
    };
    setProducts([...products, newProduct]);
    setFormData({ code: '', name: '', formulation: '', strength: '' });
    setOpenDialog(false);
  };

  const filteredProducts = products.filter(p =>
    p.product_code.toLowerCase().includes(search.toLowerCase()) ||
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Master Data</h1>
          <p className="text-muted-foreground">Pharmaceutical product specifications and formulations</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Product</DialogTitle>
              <DialogDescription>Add a new pharmaceutical product to the master database</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Product Code</Label>
                <Input placeholder="AMK-100" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input placeholder="Amikacin Sulfate Injection" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Formulation</Label>
                <Input placeholder="Injection" value={formData.formulation} onChange={e => setFormData({...formData, formulation: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Strength</Label>
                <Input placeholder="100mg/2mL" value={formData.strength} onChange={e => setFormData({...formData, strength: e.target.value})} />
              </div>
              <Button onClick={handleAddProduct} className="w-full bg-blue-600 hover:bg-blue-500">Add Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Products</p>
            <p className="text-3xl font-bold">{products.length}</p>
            <p className="text-xs text-green-600 mt-2">{products.filter(p => p.is_active).length} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Formulations</p>
            <p className="text-3xl font-bold">{new Set(products.map(p => p.formulation)).size}</p>
            <p className="text-xs text-blue-600 mt-2">Unique types</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Batches This Year</p>
            <p className="text-3xl font-bold">0</p>
            <p className="text-xs text-amber-600 mt-2">All products</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search product code or name..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />Filter</Button>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
          <CardDescription>{filteredProducts.length} products found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Product Name</TableHead>
                  <TableHead className="font-semibold">Formulation</TableHead>
                  <TableHead className="font-semibold">Strength</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No products found. Add a product to get started.
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono font-semibold text-sm">{product.product_code}</TableCell>
                    <TableCell className="text-sm font-medium">{product.product_name}</TableCell>
                    <TableCell className="text-sm">{product.formulation}</TableCell>
                    <TableCell className="text-sm">{product.strength}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" variant="outline">
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center flex justify-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
