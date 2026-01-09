import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Product {
    id: number;
    name: string;
    code: string;
    unit_price: number;
    vat_rate: number;
    unit: string;
}

const ProductList = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        code: '',
        unit_price: 0,
        vat_rate: 20,
        unit: 'Adet'
    });

    const { data: products, isLoading } = useQuery<Product[]>({
        queryKey: ['products'],
        queryFn: async () => {
            const res = await api.get('/products');
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: async (product: any) => {
            return api.post('/products', product);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setIsOpen(false);
            setNewProduct({ name: '', code: '', unit_price: 0, vat_rate: 20, unit: 'Adet' });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newProduct);
    };

    if (isLoading) return <div>Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Ürün ve Hizmetler</h2>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Yeni Ürün</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Ürün Ekle</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="name">Ürün Adı</Label>
                                <Input
                                    id="name"
                                    required
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="code">Ürün Kodu</Label>
                                <Input
                                    id="code"
                                    required
                                    value={newProduct.code}
                                    onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="price">Birim Fiyat</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        required
                                        value={newProduct.unit_price}
                                        onChange={(e) => setNewProduct({ ...newProduct, unit_price: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="vat">KDV (%)</Label>
                                    <select
                                        id="vat"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        value={newProduct.vat_rate}
                                        onChange={(e) => setNewProduct({ ...newProduct, vat_rate: parseInt(e.target.value) })}
                                    >
                                        <option value={0}>%0</option>
                                        <option value={1}>%1</option>
                                        <option value={10}>%10</option>
                                        <option value={20}>%20</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="unit">Birim</Label>
                                <Input
                                    id="unit"
                                    value={newProduct.unit}
                                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                                />
                            </div>
                            <Button type="submit">Kaydet</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kod</TableHead>
                                <TableHead>Ürün Adı</TableHead>
                                <TableHead>Birim Fiyat</TableHead>
                                <TableHead>KDV</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products?.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>{product.code}</TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(product.unit_price)}
                                    </TableCell>
                                    <TableCell>%{product.vat_rate}</TableCell>
                                </TableRow>
                            ))}
                            {products?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Kayıt bulunamadı.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProductList;
