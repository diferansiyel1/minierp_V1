import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface QuoteItem {
    product_id: number | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    discount_percent: number;
    vat_rate: number;
    line_total: number;
    vat_amount: number;
    total_with_vat: number;
}

const UNIT_OPTIONS = [
    'Adet', 'Ay', 'Hafta', 'Gün', 'Saat', 'Kutu', 'Paket', 'Koli', 'Litre', 'Kg', 'Metre'
];

const QuoteBuilder = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const dealId = searchParams.get('deal_id');
    const quoteId = searchParams.get('quote_id');
    const isEditMode = !!quoteId;

    const [accountId, setAccountId] = useState('');
    const [contactId, setContactId] = useState('');
    const [currency, setCurrency] = useState('TRY');
    const [validUntil, setValidUntil] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([]);

    const { data: accounts } = useQuery({
        queryKey: ['accounts', 'customers'],
        queryFn: async () => (await api.get('/accounts/customers')).data
    });

    const { data: products } = useQuery({
        queryKey: ['products'],
        queryFn: async () => (await api.get('/products')).data
    });

    // Fetch contacts for selected account
    const { data: contacts } = useQuery({
        queryKey: ['contacts', accountId],
        queryFn: async () => {
            if (!accountId) return [];
            const res = await api.get(`/contacts?account_id=${accountId}`);
            return res.data;
        },
        enabled: !!accountId
    });

    const { data: deal } = useQuery({
        queryKey: ['deal', dealId],
        queryFn: async () => {
            if (!dealId) return null;
            const res = await api.get(`/sales/deals/${dealId}`);
            return res.data;
        },
        enabled: !!dealId
    });

    // Fetch existing quote for edit mode
    const { data: existingQuote } = useQuery({
        queryKey: ['quote', quoteId],
        queryFn: async () => {
            if (!quoteId) return null;
            const res = await api.get(`/sales/quotes/${quoteId}`);
            return res.data;
        },
        enabled: isEditMode
    });

    // Pre-fill from deal
    useEffect(() => {
        if (deal) {
            setAccountId(deal.customer_id?.toString() || '');
        }
    }, [deal]);

    // Pre-fill from existing quote (edit mode)
    useEffect(() => {
        if (existingQuote) {
            setAccountId(existingQuote.account_id?.toString() || '');
            setCurrency(existingQuote.currency || 'TRY');
            setValidUntil(existingQuote.valid_until ? existingQuote.valid_until.split('T')[0] : '');
            setNotes(existingQuote.notes || '');
            setItems(existingQuote.items?.map((item: any) => ({
                product_id: item.product_id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent,
                vat_rate: item.vat_rate,
                line_total: item.line_total,
                vat_amount: item.vat_amount,
                total_with_vat: item.total_with_vat
            })) || []);
        }
    }, [existingQuote]);

    const createQuoteMutation = useMutation({
        mutationFn: async (quoteData: any) => {
            if (isEditMode) {
                return api.put(`/sales/quotes/${quoteId}`, quoteData);
            } else if (dealId) {
                return api.post(`/sales/deals/${dealId}/convert-to-quote`, quoteData);
            } else {
                return api.post('/sales/quotes', quoteData);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            navigate('/quotes');
        }
    });

    const addItem = () => {
        setItems([...items, {
            product_id: null,
            description: '',
            quantity: 1,
            unit: 'Adet',
            unit_price: 0,
            discount_percent: 0,
            vat_rate: 20,
            line_total: 0,
            vat_amount: 0,
            total_with_vat: 0
        }]);
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

        // Recalculate
        const lineTotal = item.quantity * item.unit_price;
        const discount = lineTotal * (item.discount_percent / 100);
        const discountedTotal = lineTotal - discount;
        const vatAmount = discountedTotal * (item.vat_rate / 100);

        item.line_total = lineTotal;
        item.vat_amount = vatAmount;
        item.total_with_vat = discountedTotal + vatAmount;

        newItems[index] = item;
        setItems(newItems);
    };

    const calculateSubtotal = () => items.reduce((acc, item) => acc + item.line_total, 0);
    const calculateDiscount = () => items.reduce((acc, item) => acc + (item.line_total * item.discount_percent / 100), 0);
    const calculateVat = () => items.reduce((acc, item) => acc + item.vat_amount, 0);
    const calculateGrandTotal = () => calculateSubtotal() - calculateDiscount() + calculateVat();

    const handleSave = () => {
        if (!accountId || items.length === 0) {
            alert('Lütfen müşteri seçin ve en az bir kalem ekleyin.');
            return;
        }

        const quoteData = {
            account_id: parseInt(accountId),
            contact_id: contactId ? parseInt(contactId) : null,
            currency: currency,
            valid_until: validUntil || null,
            notes: notes || null,
            items: items.map(item => ({
                product_id: item.product_id,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent,
                vat_rate: item.vat_rate
            }))
        };

        createQuoteMutation.mutate(quoteData);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        {isEditMode ? 'Teklifi Düzenle' : dealId ? 'Fırsattan Teklif Oluştur' : 'Yeni Teklif'}
                    </h2>
                    {deal && (
                        <p className="text-muted-foreground">Fırsat: {deal.title}</p>
                    )}
                </div>
                <Button onClick={handleSave} disabled={createQuoteMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {createQuoteMutation.isPending ? 'Kaydediliyor...' : 'Teklifi Kaydet'}
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Teklif Bilgileri</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Müşteri *</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={accountId}
                                    onChange={(e) => { setAccountId(e.target.value); setContactId(''); }}
                                    disabled={!!dealId}
                                >
                                    <option value="">Müşteri seçin...</option>
                                    {accounts?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>İlgili Kişi</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={contactId}
                                    onChange={(e) => setContactId(e.target.value)}
                                    disabled={!accountId}
                                >
                                    <option value="">İlgili kişi seçin...</option>
                                    {contacts?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.role ? `(${c.role})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Geçerlilik Tarihi</Label>
                                <Input
                                    type="date"
                                    value={validUntil}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Para Birimi</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                >
                                    <option value="TRY">₺ TRY (Türk Lirası)</option>
                                    <option value="EUR">€ EUR (Euro)</option>
                                    <option value="USD">$ USD (Amerikan Doları)</option>
                                    <option value="GBP">£ GBP (İngiliz Sterlini)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                            <Label>Notlar</Label>
                            <Textarea
                                placeholder="Teklif ile ilgili notlar..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Özet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ara Toplam:</span>
                            <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateSubtotal())}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">İskonto:</span>
                            <span className="text-red-500">-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateDiscount())}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">KDV:</span>
                            <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateVat())}</span>
                        </div>
                        <hr />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Genel Toplam:</span>
                            <span className="text-green-500">
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(calculateGrandTotal())}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Teklif Kalemleri</CardTitle>
                    <Button variant="outline" size="sm" onClick={addItem}>
                        <Plus className="mr-2 h-4 w-4" /> Kalem Ekle
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[18%]">Ürün</TableHead>
                                <TableHead className="w-[18%]">Açıklama</TableHead>
                                <TableHead className="w-[8%]">Miktar</TableHead>
                                <TableHead className="w-[10%]">Birim</TableHead>
                                <TableHead className="w-[12%]">Birim Fiyat</TableHead>
                                <TableHead className="w-[8%]">İsk. %</TableHead>
                                <TableHead className="w-[8%]">KDV</TableHead>
                                <TableHead className="w-[12%]">Toplam</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <select
                                            className="w-full bg-transparent border rounded px-2 py-1 text-sm"
                                            value={item.product_id || ''}
                                            onChange={(e) => updateItem(index, 'product_id', e.target.value ? parseInt(e.target.value) : null)}
                                        >
                                            <option value="">Serbest</option>
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
                                            className="text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-16 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={item.unit}
                                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                            className="w-full bg-transparent border rounded px-2 py-1 text-sm"
                                        >
                                            {UNIT_OPTIONS.map((u) => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.unit_price}
                                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                            className="w-24 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.discount_percent}
                                            onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                                            className="w-16 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={item.vat_rate}
                                            onChange={(e) => updateItem(index, 'vat_rate', parseInt(e.target.value))}
                                            className="bg-transparent border rounded px-2 py-1 text-sm"
                                        >
                                            <option value={0}>%0</option>
                                            <option value={1}>%1</option>
                                            <option value={10}>%10</option>
                                            <option value={20}>%20</option>
                                        </select>
                                    </TableCell>
                                    <TableCell className="font-bold text-sm">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(item.total_with_vat)}
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
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Henüz kalem eklenmedi. "Kalem Ekle" butonuna tıklayın.
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

export default QuoteBuilder;
