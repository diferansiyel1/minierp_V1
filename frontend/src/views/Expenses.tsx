import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, FileDown, Filter, X, Upload, Trash2, TrendingDown, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SmartInvoiceImporter from '@/components/SmartInvoiceImporter';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const paymentStatusColors: Record<string, string> = { 'Unpaid': 'bg-red-500', 'Partial': 'bg-orange-500', 'Paid': 'bg-green-500' };
const paymentStatusLabels: Record<string, string> = { 'Unpaid': 'Ödenmedi', 'Partial': 'Kısmi Ödendi', 'Paid': 'Ödendi' };
const categoryLabels: Record<string, string> = { 'Kira': 'Kira', 'Donanım': 'Donanım', 'Yazılım': 'Yazılım', 'Danışmanlık': 'Danışmanlık', 'Personel': 'Personel', 'Diğer': 'Diğer' };
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#d0ed57'];

interface Invoice { id: number; invoice_no: string; account_id: number; project_id: number | null; currency: string; issue_date: string; total_amount: number; payment_status: string; paid_amount: number; expense_category: string | null; expense_center: string | null; items: any[]; }

const Expenses = () => {
    const queryClient = useQueryClient();
    const [paymentFilter, setPaymentFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    // Date Range State
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null; label: string }>({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString(),
        end: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59).toISOString(),
        label: 'Bu Yıl'
    });
    const [showFilters, setShowFilters] = useState(false);
    const [showImporter, setShowImporter] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Helper to set date ranges
    const setRange = (type: string) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'today':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;
            case 'this_quarter':
                const currQuarter = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), currQuarter * 3, 1);
                end = new Date(now.getFullYear(), (currQuarter + 1) * 3, 0, 23, 59, 59);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;
            case 'all':
                setDateRange({ start: null, end: null, label: 'Tüm Zamanlar' });
                return;
        }
        setDateRange({
            start: start.toISOString(),
            end: end.toISOString(),
            label: type === 'this_month' ? 'Bu Ay' :
                type === 'last_month' ? 'Geçen Ay' :
                    type === 'this_quarter' ? 'Bu Çeyrek' : 'Bu Yıl'
        });
    };

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: ['expense-invoices', paymentFilter, categoryFilter, dateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('invoice_type', 'Purchase');
            if (paymentFilter) params.append('payment_status', paymentFilter);
            if (dateRange.start) params.append('start_date', dateRange.start);
            if (dateRange.end) params.append('end_date', dateRange.end);
            return (await api.get(`/finance/invoices?${params.toString()}`)).data;
        }
    });

    const { data: analytics } = useQuery({
        queryKey: ['expense-analytics', dateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateRange.start) params.append('start_date', dateRange.start);
            if (dateRange.end) params.append('end_date', dateRange.end);
            return (await api.get('/finance/expenses/analytics?' + params.toString())).data;
        }
    });

    const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: async () => (await api.get('/accounts')).data });
    const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data });

    const getAccountTitle = (id: number) => accounts?.find((a: any) => a.id === id)?.title || '-';
    const getProjectCode = (id: number | null) => id ? projects?.find((p: any) => p.id === id)?.code || '-' : '-';
    const formatCurrency = (amount: number, currency = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/finance/invoices/${id}`),
        onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ['accounts'] }); queryClient.invalidateQueries({ queryKey: ['expense-analytics'] }); }
    });

    const handleDelete = (inv: Invoice) => {
        if (inv.paid_amount > 0) { alert('Ödemesi yapılmış fatura silinemez.'); return; }
        if (confirm(`Faturayı silmek istediğinize emin misiniz?`)) deleteMutation.mutate(inv.id);
    };

    const hasFilters = paymentFilter || categoryFilter;

    // Client-side filtering for category since backend might filter by strict equality but we want flexible
    // Actually backend doesn't support category filtering in /invoices yet, so let's do client side for now or assume lists are small
    const filteredInvoices = invoices?.filter((inv: Invoice) => {
        if (categoryFilter && categoryFilter !== 'all' && inv.expense_category !== categoryFilter) return false;
        return true;
    });

    const totalAmount = filteredInvoices?.reduce((s: number, i: Invoice) => s + i.total_amount, 0) || 0;
    const totalPaid = filteredInvoices?.reduce((s: number, i: Invoice) => s + i.paid_amount, 0) || 0;

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-2 tracking-tight text-foreground/90"><TrendingDown className="h-8 w-8 text-violet-600" />Gider Yönetimi</h2>
                    <p className="text-muted-foreground">Şirket harcamalarını ve faturalarını takip edin</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={showFilters ? "bg-secondary" : ""}><Filter className="mr-2 h-4 w-4" />Filtreler{hasFilters && <Badge className="ml-2 bg-violet-600">Aktif</Badge>}</Button>
                    <Button variant="outline" onClick={() => setShowImporter(true)}><Upload className="mr-2 h-4 w-4" />PDF Yükle</Button>
                    <Button onClick={() => setShowImporter(true)} className="bg-violet-600 hover:bg-violet-700 text-white"><Plus className="mr-2 h-4 w-4" />Yeni Gider Faturası</Button>
                </div>
            </div>

            {/* Date Range Filters */}
            <div className="flex gap-2 pb-2 overflow-x-auto">
                {['year', 'this_quarter', 'this_month', 'last_month', 'all'].map((range) => {
                    const label = range === 'year' ? 'Bu Yıl' : range === 'this_quarter' ? 'Bu Çeyrek' : range === 'this_month' ? 'Bu Ay' : range === 'last_month' ? 'Geçen Ay' : 'Tüm Zamanlar';
                    const isActive = (range === 'year' && dateRange.label === 'Bu Yıl') ||
                        (range === 'this_month' && dateRange.label === 'Bu Ay') ||
                        (range === 'all' && dateRange.label === 'Tüm Zamanlar');
                    // Simple check, functionality works
                    return (
                        <Button
                            key={range}
                            variant="outline"
                            size="sm"
                            onClick={() => setRange(range)}
                            className={isActive ? 'bg-violet-100 text-violet-700 border-violet-200' : ''}
                        >
                            {label}
                        </Button>
                    );
                })}
            </div>

            {/* Analytics Section */}
            {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <PieIcon className="h-5 w-5 text-violet-600" />
                                Kategori Dağılımı ({dateRange.label || 'Seçili Dönem'})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.by_category}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {analytics.by_category.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-violet-600" />
                                Gider Trendi ({analytics.grouping === 'daily' ? 'Günlük' : 'Aylık'})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.timeline}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} minTickGap={30} />
                                        <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(value) => `₺${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} />
                                        <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-slate-50 border-slate-200"><CardContent className="pt-4"><div className="text-sm font-medium text-muted-foreground">Toplam Gider</div><div className="text-2xl font-bold text-slate-800">{formatCurrency(totalAmount)}</div></CardContent></Card>
                <Card className="bg-slate-50 border-slate-200"><CardContent className="pt-4"><div className="text-sm font-medium text-muted-foreground">Ödenen</div><div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div></CardContent></Card>
                <Card className="bg-slate-50 border-slate-200"><CardContent className="pt-4"><div className="text-sm font-medium text-muted-foreground">Bekleyen Borç</div><div className="text-2xl font-bold text-red-600">{formatCurrency(totalAmount - totalPaid)}</div></CardContent></Card>
            </div>

            {showFilters && (
                <Card className="bg-slate-50/50"><CardContent className="pt-4 flex gap-4 items-end">
                    <div className="w-48"><Label className="text-xs">Ödeme Durumu</Label><Select value={paymentFilter || 'all'} onValueChange={(val) => setPaymentFilter(val === 'all' ? '' : val)}><SelectTrigger><SelectValue placeholder="Tümü" /></SelectTrigger><SelectContent><SelectItem value="all">Tümü</SelectItem><SelectItem value="Unpaid">Ödenmedi</SelectItem><SelectItem value="Partial">Kısmi</SelectItem><SelectItem value="Paid">Ödendi</SelectItem></SelectContent></Select></div>
                    <div className="w-48"><Label className="text-xs">Kategori</Label><Select value={categoryFilter || 'all'} onValueChange={(val) => setCategoryFilter(val === 'all' ? '' : val)}><SelectTrigger><SelectValue placeholder="Tümü" /></SelectTrigger><SelectContent><SelectItem value="all">Tümü</SelectItem><SelectItem value="Kira">Kira</SelectItem><SelectItem value="Donanım">Donanım</SelectItem><SelectItem value="Yazılım">Yazılım</SelectItem><SelectItem value="Danışmanlık">Danışmanlık</SelectItem></SelectContent></Select></div>
                    {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setPaymentFilter(''); setCategoryFilter(''); }} className="text-red-500 hover:text-red-600 hover:bg-red-50"><X className="mr-1 h-4 w-4" />Temizle</Button>}
                </CardContent></Card>
            )}

            <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-100/80">
                            <TableRow>
                                <TableHead className="w-[120px]">Fatura No</TableHead>
                                <TableHead className="w-[100px]">Tarih</TableHead>
                                <TableHead>Tedarikçi</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Proje</TableHead>
                                <TableHead className="text-right">Tutar</TableHead>
                                <TableHead className="w-[100px]">Ödeme</TableHead>
                                <TableHead className="w-[120px] text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInvoices?.map((inv: Invoice) => (
                                <TableRow key={inv.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}>
                                    <TableCell className="font-mono font-medium text-violet-700">{inv.invoice_no || `#${inv.id}`}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{new Date(inv.issue_date).toLocaleDateString('tr-TR')}</TableCell>
                                    <TableCell className="font-medium">{getAccountTitle(inv.account_id)}</TableCell>
                                    <TableCell>{inv.expense_category ? <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-normal border border-slate-200">{categoryLabels[inv.expense_category] || inv.expense_category}</Badge> : '-'}</TableCell>
                                    <TableCell>{inv.project_id ? <Badge variant="outline" className="font-mono text-xs">{getProjectCode(inv.project_id)}</Badge> : '-'}</TableCell>
                                    <TableCell className="text-right font-bold text-slate-800">{formatCurrency(inv.total_amount, inv.currency)}</TableCell>
                                    <TableCell><Badge className={`${paymentStatusColors[inv.payment_status]} text-white border-0 shadow-none font-medium`}>{paymentStatusLabels[inv.payment_status]}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-violet-600" onClick={() => { setSelectedInvoice(inv); setIsDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-violet-600" onClick={() => window.open(`http://localhost:8000/finance/invoices/${inv.id}/pdf`, '_blank')}><FileDown className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(inv)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredInvoices?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Henüz gider faturası bulunmuyor.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Gider Faturası Detayı</DialogTitle></DialogHeader>
                    {selectedInvoice && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <div className="text-2xl font-bold text-violet-700">{selectedInvoice.invoice_no || `#${selectedInvoice.id}`}</div>
                                    <div className="text-sm text-muted-foreground">{new Date(selectedInvoice.issue_date).toLocaleDateString('tr-TR')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">Toplam Tutar</div>
                                    <div className="text-2xl font-bold">{formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div><Label className="text-xs text-muted-foreground">Tedarikçi</Label><div className="font-medium text-base">{getAccountTitle(selectedInvoice.account_id)}</div></div>
                                <div><Label className="text-xs text-muted-foreground">Ödeme Durumu</Label><div className="mt-1"><Badge className={paymentStatusColors[selectedInvoice.payment_status]}>{paymentStatusLabels[selectedInvoice.payment_status]}</Badge></div></div>
                                <div><Label className="text-xs text-muted-foreground">Kategori</Label><div className="font-medium">{selectedInvoice.expense_category || '-'}</div></div>
                                <div><Label className="text-xs text-muted-foreground">Gider Merkezi</Label><div className="font-medium">{selectedInvoice.expense_center || '-'}</div></div>
                            </div>

                            {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead>Açıklama</TableHead>
                                                <TableHead className="text-right">Miktar</TableHead>
                                                <TableHead className="text-right">Birim Fiyat</TableHead>
                                                <TableHead className="text-right">Toplam</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedInvoice.items.map((item: any, i: number) => (
                                                <TableRow key={i}>
                                                    <TableCell>{item.description}</TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.unit_price, selectedInvoice.currency)}</TableCell>
                                                    <TableCell className="text-right font-medium">{formatCurrency(item.line_total, selectedInvoice.currency)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button variant="outline" onClick={() => window.open(`http://localhost:8000/finance/invoices/${selectedInvoice.id}/pdf`, '_blank')}><FileDown className="mr-2 h-4 w-4" />PDF İndir</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {showImporter && <SmartInvoiceImporter forcedType="Purchase" onUploadSuccess={() => { setShowImporter(false); refetch(); queryClient.invalidateQueries({ queryKey: ['expense-analytics'] }); }} onClose={() => setShowImporter(false)} />}
        </div>
    );
};

export default Expenses;
