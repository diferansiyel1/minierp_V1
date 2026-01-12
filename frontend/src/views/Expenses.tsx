import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, FileDown, Filter, X, Upload, Trash2, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SmartInvoiceImporter from '@/components/SmartInvoiceImporter';

const paymentStatusColors: Record<string, string> = { 'Unpaid': 'bg-red-500', 'Partial': 'bg-orange-500', 'Paid': 'bg-green-500' };
const paymentStatusLabels: Record<string, string> = { 'Unpaid': 'Ödenmedi', 'Partial': 'Kısmi Ödendi', 'Paid': 'Ödendi' };
const categoryLabels: Record<string, string> = { 'Kira': 'Kira', 'Donanım': 'Donanım', 'Yazılım': 'Yazılım', 'Danışmanlık': 'Danışmanlık', 'Personel': 'Personel', 'Diğer': 'Diğer' };

interface Invoice { id: number; invoice_no: string; account_id: number; project_id: number | null; currency: string; issue_date: string; total_amount: number; payment_status: string; paid_amount: number; expense_category: string | null; expense_center: string | null; items: any[]; }

const Expenses = () => {
    const queryClient = useQueryClient();
    const [paymentFilter, setPaymentFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [showImporter, setShowImporter] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: ['expense-invoices', paymentFilter, categoryFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('invoice_type', 'Purchase');
            if (paymentFilter) params.append('payment_status', paymentFilter);
            return (await api.get(`/finance/invoices?${params.toString()}`)).data;
        }
    });

    const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: async () => (await api.get('/accounts')).data });
    const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });

    const getAccountTitle = (id: number) => accounts?.find((a: any) => a.id === id)?.title || '-';
    const getProjectCode = (id: number | null) => id ? projects?.find((p: any) => p.id === id)?.code || '-' : '-';
    const formatCurrency = (amount: number, currency = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/finance/invoices/${id}`),
        onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ['accounts'] }); }
    });

    const handleDelete = (inv: Invoice) => {
        if (inv.paid_amount > 0) { alert('Ödemesi yapılmış fatura silinemez.'); return; }
        if (confirm(`Faturayı silmek istediğinize emin misiniz?`)) deleteMutation.mutate(inv.id);
    };

    const hasFilters = paymentFilter || categoryFilter;
    const totalAmount = invoices?.reduce((s: number, i: Invoice) => s + i.total_amount, 0) || 0;
    const totalPaid = invoices?.reduce((s: number, i: Invoice) => s + i.paid_amount, 0) || 0;

    if (isLoading) return <div className="flex items-center justify-center h-64">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-2"><TrendingDown className="h-8 w-8 text-red-600" />Gider Faturaları</h2>
                    <p className="text-muted-foreground">Tedarikçilerden gelen faturaları yönetin</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowFilters(!showFilters)}><Filter className="mr-2 h-4 w-4" />Filtreler{hasFilters && <Badge className="ml-2 bg-blue-500">Aktif</Badge>}</Button>
                    <Button variant="outline" onClick={() => setShowImporter(true)}><Upload className="mr-2 h-4 w-4" />PDF Yükle</Button>
                    <Button onClick={() => setShowImporter(true)}><Plus className="mr-2 h-4 w-4" />Yeni Gider Faturası</Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Toplam Gider</div><div className="text-2xl font-bold text-red-600">{formatCurrency(totalAmount)}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Ödenen</div><div className="text-2xl font-bold text-blue-600">{formatCurrency(totalPaid)}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Bekleyen Borç</div><div className="text-2xl font-bold text-orange-600">{formatCurrency(totalAmount - totalPaid)}</div></CardContent></Card>
            </div>

            {showFilters && (
                <Card><CardContent className="pt-4 flex gap-4 items-end">
                    <div className="w-48"><Label className="text-xs">Ödeme Durumu</Label><Select value={paymentFilter || 'all'} onValueChange={(val) => setPaymentFilter(val === 'all' ? '' : val)}><SelectTrigger><SelectValue placeholder="Tümü" /></SelectTrigger><SelectContent><SelectItem value="all">Tümü</SelectItem><SelectItem value="Unpaid">Ödenmedi</SelectItem><SelectItem value="Partial">Kısmi</SelectItem><SelectItem value="Paid">Ödendi</SelectItem></SelectContent></Select></div>
                    <div className="w-48"><Label className="text-xs">Kategori</Label><Select value={categoryFilter || 'all'} onValueChange={(val) => setCategoryFilter(val === 'all' ? '' : val)}><SelectTrigger><SelectValue placeholder="Tümü" /></SelectTrigger><SelectContent><SelectItem value="all">Tümü</SelectItem><SelectItem value="Kira">Kira</SelectItem><SelectItem value="Donanım">Donanım</SelectItem><SelectItem value="Yazılım">Yazılım</SelectItem><SelectItem value="Danışmanlık">Danışmanlık</SelectItem></SelectContent></Select></div>
                    {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setPaymentFilter(''); setCategoryFilter(''); }}><X className="mr-1 h-4 w-4" />Temizle</Button>}
                </CardContent></Card>
            )}

            <Card><CardContent className="p-0">
                <Table>
                    <TableHeader><TableRow><TableHead>Fatura No</TableHead><TableHead>Tarih</TableHead><TableHead>Tedarikçi</TableHead><TableHead>Kategori</TableHead><TableHead>Proje</TableHead><TableHead className="text-right">Tutar</TableHead><TableHead>Ödeme</TableHead><TableHead>İşlemler</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {invoices?.map((inv: Invoice) => (
                            <TableRow key={inv.id}>
                                <TableCell className="font-mono">{inv.invoice_no || `#${inv.id}`}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{new Date(inv.issue_date).toLocaleDateString('tr-TR')}</TableCell>
                                <TableCell>{getAccountTitle(inv.account_id)}</TableCell>
                                <TableCell>{inv.expense_category ? <Badge variant="outline">{categoryLabels[inv.expense_category] || inv.expense_category}</Badge> : '-'}</TableCell>
                                <TableCell>{inv.project_id ? <Badge variant="outline">{getProjectCode(inv.project_id)}</Badge> : '-'}</TableCell>
                                <TableCell className="text-right font-bold text-red-600">{formatCurrency(inv.total_amount, inv.currency)}</TableCell>
                                <TableCell><Badge className={paymentStatusColors[inv.payment_status]}>{paymentStatusLabels[inv.payment_status]}</Badge></TableCell>
                                <TableCell><div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => window.open(`http://localhost:8000/finance/invoices/${inv.id}/pdf`, '_blank')}><FileDown className="h-4 w-4 text-red-600" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(inv)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                </div></TableCell>
                            </TableRow>
                        ))}
                        {invoices?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Henüz gider faturası yok.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent></Card>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Gider Faturası: {selectedInvoice?.invoice_no || `#${selectedInvoice?.id}`}</DialogTitle></DialogHeader>
                    {selectedInvoice && <div className="space-y-4"><div className="grid grid-cols-3 gap-4 text-sm"><div><span className="text-muted-foreground">Tedarikçi:</span><div className="font-medium">{getAccountTitle(selectedInvoice.account_id)}</div></div><div><span className="text-muted-foreground">Kategori:</span><div className="font-medium">{selectedInvoice.expense_category || '-'}</div></div><div><span className="text-muted-foreground">Gider Merkezi:</span><div className="font-medium">{selectedInvoice.expense_center || '-'}</div></div></div><div className="text-right text-2xl font-bold text-red-600">{formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}</div></div>}
                </DialogContent>
            </Dialog>

            {showImporter && <SmartInvoiceImporter forcedType="Purchase" onUploadSuccess={() => { setShowImporter(false); refetch(); }} onClose={() => setShowImporter(false)} />}
        </div>
    );
};

export default Expenses;
