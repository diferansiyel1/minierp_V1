import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, FileText, FileInput } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const InvoiceBuilder = () => {
    const queryClient = useQueryClient();
    const [invoiceType, setInvoiceType] = useState<'Sales' | 'Purchase'>('Sales');
    const [accountId, setAccountId] = useState('');
    const [currency, setCurrency] = useState('TRY');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [items, setItems] = useState<any[]>([]);

    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/accounts')).data
    });
    const { data: products } = useQuery({
        queryKey: ['products'],
        queryFn: async () => (await api.get('/products')).data
    });

    const createInvoiceMutation = useMutation({
        mutationFn: async (invoice: any) => {
            return api.post('/finance/invoices', invoice);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            alert('Fatura başarıyla oluşturuldu!');
            setItems([]);
            setAccountId('');
            setInvoiceNo('');
        }
    });

    const addItem = () => {
        setItems([...items, { product_id: null, description: '', quantity: 1, unit_price: 0, vat_rate: 20, total: 0 }]);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        if (field === 'product_id' && products) {
            const product = products.find((p: any) => p.id == value);
            if (product) {
                item.unit_price = product.unit_price;
                item.vat_rate = product.vat_rate;
                item.description = product.name;
            }
        }

        item.total = item.quantity * item.unit_price * (1 + item.vat_rate / 100);
        newItems[index] = item;
        setItems(newItems);
    };

    const calculateSubtotal = () => items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const calculateVat = () => items.reduce((acc, item) => acc + (item.quantity * item.unit_price * item.vat_rate / 100), 0);
    const calculateGrandTotal = () => calculateSubtotal() + calculateVat();

    const handleSave = () => {
        if (!accountId || items.length === 0) {
            alert('Lütfen hesap seçin ve en az bir kalem ekleyin.');
            return;
        }

        const invoice = {
            invoice_type: invoiceType,
            invoice_no: invoiceNo,
            account_id: parseInt(accountId),
            currency: currency,
            items: items.map(item => ({
                product_id: item.product_id || null,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                vat_rate: item.vat_rate
            }))
        };

        createInvoiceMutation.mutate(invoice);
    };

    // Filter accounts based on invoice type
    const filteredAccounts = accounts?.filter((a: any) => {
        if (invoiceType === 'Sales') {
            return a.account_type === 'Customer' || a.account_type === 'Both';
        } else {
            return a.account_type === 'Supplier' || a.account_type === 'Both';
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">Fatura Oluştur</h2>
                <div className="flex gap-2">
                    <Button
                        variant={invoiceType === 'Sales' ? 'default' : 'outline'}
                        onClick={() => { setInvoiceType('Sales'); setAccountId(''); }}
                    >
                        <FileText className="mr-2 h-4 w-4" /> Satış Faturası
                    </Button>
                    <Button
                        variant={invoiceType === 'Purchase' ? 'default' : 'outline'}
                        onClick={() => { setInvoiceType('Purchase'); setAccountId(''); }}
                    >
                        <FileInput className="mr-2 h-4 w-4" /> Gider Faturası
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>
                            {invoiceType === 'Sales' ? 'Müşteri Bilgileri' : 'Tedarikçi Bilgileri'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label>{invoiceType === 'Sales' ? 'Müşteri' : 'Tedarikçi'} Seçin</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                >
                                    <option value="">Seçiniz...</option>
                                    {filteredAccounts?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Fatura No</Label>
                                <Input
                                    placeholder="Ör: FTR-2024-001"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Para Birimi</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                >
                                    <option value="TRY">₺ TRY</option>
                                    <option value="EUR">€ EUR</option>
                                    <option value="USD">$ USD</option>
                                    <option value="GBP">£ GBP</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Özet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Ara Toplam:</span>
                            <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateSubtotal())}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">KDV:</span>
                            <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateVat())}</span>
                        </div>
                        <hr />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Genel Toplam:</span>
                            <span className={invoiceType === 'Sales' ? 'text-green-500' : 'text-red-500'}>
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateGrandTotal())}
                            </span>
                        </div>
                        <Button
                            className="w-full mt-4"
                            onClick={handleSave}
                            disabled={createInvoiceMutation.isPending}
                        >
                            {createInvoiceMutation.isPending ? 'Kaydediliyor...' : 'Faturayı Kaydet'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Fatura Kalemleri</CardTitle>
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Satır Ekle</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[25%]">Ürün/Hizmet</TableHead>
                                <TableHead className="w-[20%]">Açıklama</TableHead>
                                <TableHead>Miktar</TableHead>
                                <TableHead>Birim Fiyat</TableHead>
                                <TableHead>KDV</TableHead>
                                <TableHead>Toplam</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <select
                                            className="w-full bg-transparent border rounded px-2 py-1"
                                            value={item.product_id || ''}
                                            onChange={(e) => updateItem(index, 'product_id', e.target.value ? parseInt(e.target.value) : null)}
                                        >
                                            <option value="">Serbest Giriş</option>
                                            {products?.map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                            ))}
                                        </select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            placeholder="Açıklama"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-20"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.unit_price}
                                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                            className="w-24"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={item.vat_rate}
                                            onChange={(e) => updateItem(index, 'vat_rate', parseInt(e.target.value))}
                                            className="bg-transparent border rounded px-2 py-1"
                                        >
                                            <option value={0}>%0</option>
                                            <option value={1}>%1</option>
                                            <option value={10}>%10</option>
                                            <option value={20}>%20</option>
                                        </select>
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(item.total)}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Henüz kalem eklenmedi. "Satır Ekle" butonuna tıklayın.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default InvoiceBuilder;
