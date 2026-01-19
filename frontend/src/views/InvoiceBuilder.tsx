import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, FileText, FileInput, FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InvoiceItem {
    product_id: number | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    vat_rate: number;
    withholding_rate: number;
    line_total: number;
    vat_amount: number;
    withholding_amount: number;
    total_with_vat: number;
    is_exempt: boolean;
    exemption_code: string | null;
    original_vat_rate: number;
}

const UNIT_OPTIONS = [
    'Adet', 'Ay', 'Hafta', 'Gün', 'Saat', 'Kutu', 'Paket', 'Koli', 'Litre', 'Kg', 'Metre'
];

const WITHHOLDING_RATES = [
    { value: 0, label: 'Yok' },
    { value: 0.2, label: '2/10 (KDV %20)' },
    { value: 0.3, label: '3/10 (KDV %30)' },
    { value: 0.4, label: '4/10 (KDV %40)' },
    { value: 0.5, label: '5/10 (KDV %50)' },
    { value: 0.7, label: '7/10 (KDV %70)' },
    { value: 0.9, label: '9/10 (KDV %90)' },
];

const InvoiceBuilder = () => {
    const queryClient = useQueryClient();
    const [invoiceType, setInvoiceType] = useState<'Sales' | 'Purchase'>('Sales');
    const [accountId, setAccountId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [currency, setCurrency] = useState('TRY');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [items, setItems] = useState<InvoiceItem[]>([]);

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await api.get('/accounts/');
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const res = await api.get('/products/');
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const res = await api.get('/projects');
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const createInvoiceMutation = useMutation({
        mutationFn: async (invoice: any) => {
            return api.post('/finance/invoices', invoice);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['income-expense-chart'] });
            queryClient.invalidateQueries({ queryKey: ['project-chart'] });
            alert('Fatura başarıyla oluşturuldu!');
            setItems([]);
            setAccountId('');
            setProjectId('');
            setInvoiceNo('');
        }
    });

    const addItem = () => {
        setItems([...items, {
            product_id: null,
            description: '',
            quantity: 1,
            unit: 'Adet',
            unit_price: 0,
            vat_rate: 20,
            withholding_rate: 0,
            line_total: 0,
            vat_amount: 0,
            withholding_amount: 0,
            total_with_vat: 0,
            is_exempt: false,
            exemption_code: null,
            original_vat_rate: 20
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

        // Get selected project to check for Technopark exemption
        const selectedProject = projects?.find((p: any) => p.id === parseInt(projectId));
        const isTechnoparkProject = selectedProject?.is_technopark_project;

        if (field === 'product_id' && products) {
            const product = products.find((p: any) => p.id == value);
            if (product) {
                item.unit_price = product.unit_price;
                item.description = product.name;
                item.original_vat_rate = product.vat_rate;

                // Otomasyon: Teknokent + Yazılım = Muaf (otomatik işaretle)
                if (isTechnoparkProject && product.is_software_product) {
                    item.is_exempt = true;
                    item.exemption_code = "3065 G.20/1";
                    item.vat_rate = 0;
                } else {
                    item.is_exempt = false;
                    item.exemption_code = null;
                    item.vat_rate = product.vat_rate;
                }
            }
        }

        // Muafiyet checkbox değiştiğinde
        if (field === 'is_exempt') {
            if (value) {
                item.exemption_code = "3065 G.20/1";
                item.vat_rate = 0;
            } else {
                item.exemption_code = null;
                item.vat_rate = item.original_vat_rate || 20;
            }
        }

        // Recalculate
        const lineTotal = item.quantity * item.unit_price;
        const actualVatRate = item.is_exempt ? 0 : item.vat_rate;
        const vatAmount = lineTotal * (actualVatRate / 100);
        const withholdingAmount = vatAmount * item.withholding_rate;
        const totalWithVat = lineTotal + vatAmount - withholdingAmount;

        item.line_total = lineTotal;
        item.vat_amount = vatAmount;
        item.withholding_amount = withholdingAmount;
        item.total_with_vat = totalWithVat;

        newItems[index] = item;
        setItems(newItems);
    };

    const calculateSubtotal = () => items.reduce((acc, item) => acc + item.line_total, 0);
    const calculateVat = () => items.reduce((acc, item) => acc + item.vat_amount, 0);
    const calculateWithholding = () => items.reduce((acc, item) => acc + item.withholding_amount, 0);
    const calculateExemptAmount = () => items.filter(i => i.is_exempt).reduce((acc, item) => acc + item.line_total, 0);
    const calculateTaxableAmount = () => items.filter(i => !i.is_exempt).reduce((acc, item) => acc + item.line_total, 0);
    const calculateGrandTotal = () => calculateSubtotal() + calculateVat() - calculateWithholding();

    const handleSave = () => {
        if (!accountId || items.length === 0) {
            alert('Lütfen hesap seçin ve en az bir kalem ekleyin.');
            return;
        }

        const invoice = {
            invoice_type: invoiceType,
            invoice_no: invoiceNo,
            account_id: parseInt(accountId),
            project_id: projectId ? parseInt(projectId) : null,
            currency: currency,
            items: items.map(item => ({
                product_id: item.product_id || null,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                vat_rate: item.is_exempt ? 0 : item.vat_rate,
                withholding_rate: item.withholding_rate,
                is_exempt: item.is_exempt,
                exemption_code: item.exemption_code,
                original_vat_rate: item.original_vat_rate
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

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);

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
                            {invoiceType === 'Sales' ? 'Satış Faturası Bilgileri' : 'Gider Faturası Bilgileri'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label>{invoiceType === 'Sales' ? 'Müşteri' : 'Tedarikçi'} *</Label>
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
                                <Label className="flex items-center gap-1">
                                    <FolderKanban className="w-4 h-4" /> Proje
                                </Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                >
                                    <option value="">Proje seçin (opsiyonel)</option>
                                    {projects?.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
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
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ara Toplam:</span>
                            <span>{formatCurrency(calculateSubtotal())}</span>
                        </div>
                        {calculateExemptAmount() > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-green-600 flex items-center gap-1">
                                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs px-1">%0</Badge>
                                    İstisnalı Matrah:
                                </span>
                                <span className="text-green-600">{formatCurrency(calculateExemptAmount())}</span>
                            </div>
                        )}
                        {calculateTaxableAmount() > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">KDV'li Matrah:</span>
                                <span>{formatCurrency(calculateTaxableAmount())}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">KDV:</span>
                            <span>{formatCurrency(calculateVat())}</span>
                        </div>
                        {calculateWithholding() > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tevkifat (-):</span>
                                <span className="text-orange-500">-{formatCurrency(calculateWithholding())}</span>
                            </div>
                        )}
                        <hr />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Genel Toplam:</span>
                            <span className={invoiceType === 'Sales' ? 'text-green-500' : 'text-red-500'}>
                                {formatCurrency(calculateGrandTotal())}
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
                    <Button variant="outline" size="sm" onClick={addItem}>
                        <Plus className="mr-2 h-4 w-4" /> Satır Ekle
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[16%]">Ürün/Hizmet</TableHead>
                                <TableHead className="w-[13%]">Açıklama</TableHead>
                                <TableHead className="w-[7%]">Miktar</TableHead>
                                <TableHead className="w-[9%]">Birim</TableHead>
                                <TableHead className="w-[10%]">Birim Fiyat</TableHead>
                                <TableHead className="w-[5%]">Muaf</TableHead>
                                <TableHead className="w-[8%]">KDV</TableHead>
                                <TableHead className="w-[12%]">Tevkifat</TableHead>
                                <TableHead className="w-[10%]">Toplam</TableHead>
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
                                            className="w-14 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={item.unit}
                                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                            className="w-full bg-transparent border rounded px-1 py-1 text-sm"
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
                                            className="w-20 text-sm"
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <input
                                            type="checkbox"
                                            checked={item.is_exempt}
                                            onChange={(e) => updateItem(index, 'is_exempt', e.target.checked)}
                                            className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                                            title="KDV Muaf"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {item.is_exempt ? (
                                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                                %0
                                            </Badge>
                                        ) : (
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
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <select
                                            value={item.withholding_rate}
                                            onChange={(e) => updateItem(index, 'withholding_rate', parseFloat(e.target.value))}
                                            className="bg-transparent border rounded px-2 py-1 text-sm"
                                        >
                                            {WITHHOLDING_RATES.map((rate) => (
                                                <option key={rate.value} value={rate.value}>{rate.label}</option>
                                            ))}
                                        </select>
                                    </TableCell>
                                    <TableCell className="font-bold text-sm">
                                        {formatCurrency(item.total_with_vat)}
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

