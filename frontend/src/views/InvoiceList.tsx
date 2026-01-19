import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Eye,
    CreditCard,
    FileDown,
    Filter,
    FileInput,
    FileOutput,
    ShieldCheck,
    X,
    Upload,
    Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

// Ödeme durumu renkleri ve etiketleri
const paymentStatusColors: Record<string, string> = {
    'Unpaid': 'bg-red-500',
    'Partial': 'bg-orange-500',
    'Paid': 'bg-green-500'
};

const paymentStatusLabels: Record<string, string> = {
    'Unpaid': 'Ödenmedi',
    'Partial': 'Kısmi Ödendi',
    'Paid': 'Ödendi'
};

// Fatura tipi etiketleri
const invoiceTypeLabels: Record<string, string> = {
    'Sales': 'Gelir (Satış)',
    'Purchase': 'Gider (Alış)'
};

interface Invoice {
    id: number;
    invoice_no: string;
    invoice_type: string;
    account_id: number;
    project_id: number | null;
    currency: string;
    issue_date: string;
    due_date: string | null;
    subtotal: number;
    vat_amount: number;
    withholding_amount: number;
    total_amount: number;
    status: string;
    payment_status: string;
    paid_amount: number;
    exempt_amount: number;
    taxable_amount: number;
    items: any[];
}

interface PaymentModalProps {
    invoice: Invoice | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, isOpen, onClose, onSuccess }) => {
    const [amount, setAmount] = useState<number>(0);
    const [financialAccountId, setFinancialAccountId] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState<string>('');

    const { data: financialAccounts } = useQuery({
        queryKey: ['financial-accounts'],
        queryFn: async () => (await api.get('/financial-accounts/')).data
    });

    // Kalan tutarı hesapla
    const remainingAmount = invoice ? invoice.total_amount - invoice.paid_amount : 0;

    // Modal açıldığında varsayılan değerleri ayarla
    React.useEffect(() => {
        if (invoice && isOpen) {
            setAmount(remainingAmount);
            setFinancialAccountId('');
            setDate(new Date().toISOString().split('T')[0]);
            setDescription('');
        }
    }, [invoice, isOpen, remainingAmount]);

    const paymentMutation = useMutation({
        mutationFn: async () => {
            return api.post(`/finance/invoices/${invoice?.id}/payment`, {
                amount: amount,
                financial_account_id: parseInt(financialAccountId),
                date: new Date(date).toISOString(),
                description: description || null
            });
        },
        onSuccess: () => {
            onSuccess();
            onClose();
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || 'Ödeme kaydedilemedi');
        }
    });

    const handleSubmit = () => {
        if (!financialAccountId) {
            alert('Lütfen bir Kasa/Banka seçin');
            return;
        }
        if (amount <= 0) {
            alert('Ödeme tutarı 0\'dan büyük olmalıdır');
            return;
        }
        paymentMutation.mutate();
    };

    const actionLabel = invoice?.invoice_type === 'Sales' ? 'Tahsilat Al' : 'Ödeme Yap';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md" aria-describedby="payment-modal-description">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        {actionLabel}
                    </DialogTitle>
                    <DialogDescription id="payment-modal-description" className="sr-only">
                        Fatura için ödeme veya tahsilat işlemi yapın.
                    </DialogDescription>
                </DialogHeader>

                {invoice && (
                    <div className="space-y-4">
                        {/* Fatura Bilgileri */}
                        <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Fatura No:</span>
                                <span className="font-mono font-medium">{invoice.invoice_no || `#${invoice.id}`}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Tutar:</span>
                                <span className="font-medium">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: invoice.currency || 'TRY' }).format(invoice.total_amount)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ödenen:</span>
                                <span className="text-green-600 font-medium">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: invoice.currency || 'TRY' }).format(invoice.paid_amount)}
                                </span>
                            </div>
                            <hr />
                            <div className="flex justify-between text-base font-bold">
                                <span>Kalan:</span>
                                <span className="text-red-600">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: invoice.currency || 'TRY' }).format(remainingAmount)}
                                </span>
                            </div>
                        </div>

                        {/* Form Alanları */}
                        <div className="space-y-3">
                            <div>
                                <Label>Ödeme Tutarı</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                    max={remainingAmount}
                                />
                            </div>

                            <div>
                                <Label>Kasa / Banka</Label>
                                <Select value={financialAccountId} onValueChange={setFinancialAccountId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Hesap seçin..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {financialAccounts?.filter((acc: any) => acc.is_active).map((acc: any) => (
                                            <SelectItem key={acc.id} value={acc.id.toString()}>
                                                {acc.name} ({acc.account_type}) - {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: acc.currency || 'TRY' }).format(acc.balance)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Tarih</Label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Açıklama (Opsiyonel)</Label>
                                <Input
                                    placeholder="Ödeme açıklaması..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>İptal</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={paymentMutation.isPending || !financialAccountId || amount <= 0}
                    >
                        {paymentMutation.isPending ? 'Kaydediliyor...' : actionLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const InvoiceList = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Filtreler
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [paymentFilter, setPaymentFilter] = useState<string>('');
    const [projectFilter, setProjectFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal state
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);

    // API sorguları
    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: ['invoices', typeFilter, paymentFilter, projectFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (typeFilter) params.append('invoice_type', typeFilter);
            if (paymentFilter) params.append('payment_status', paymentFilter);
            if (projectFilter) params.append('project_id', projectFilter);

            const url = `/finance/invoices${params.toString() ? '?' + params.toString() : ''}`;
            const res = await api.get(url);
            return res.data;
        }
    });

    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/accounts/')).data
    });

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => (await api.get('/projects')).data
    });

    const getAccountTitle = (accountId: number) => {
        const account = accounts?.find((a: any) => a.id === accountId);
        return account?.title || '-';
    };

    const getProjectCode = (projectId: number | null) => {
        if (!projectId) return '-';
        const project = projects?.find((p: any) => p.id === projectId);
        return project?.code || '-';
    };

    const formatCurrency = (amount: number, currency: string = 'TRY') => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
    };

    const handlePaymentSuccess = () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
    };

    const clearFilters = () => {
        setTypeFilter('');
        setPaymentFilter('');
        setProjectFilter('');
    };

    // Delete invoice mutation
    const deleteInvoiceMutation = useMutation({
        mutationFn: async (invoiceId: number) => {
            return api.delete(`/finance/invoices/${invoiceId}`);
        },
        onSuccess: () => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || 'Fatura silinemedi');
        }
    });

    const handleDeleteInvoice = (invoice: Invoice) => {
        if (invoice.paid_amount && invoice.paid_amount > 0) {
            alert('Ödemesi yapılmış fatura silinemez.');
            return;
        }
        if (confirm(`"${invoice.invoice_no || invoice.id}" numaralı faturayı silmek istediğinize emin misiniz?`)) {
            deleteInvoiceMutation.mutate(invoice.id);
        }
    };

    const hasActiveFilters = typeFilter || paymentFilter || projectFilter;

    if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-6">
            {/* Başlık ve Butonlar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Faturalar</h2>
                    <p className="text-muted-foreground">Gelir ve gider faturalarını yönetin</p>
                </div>
                <div className="flex gap-2 flex-wrap w-full md:w-auto">
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className={hasActiveFilters ? 'border-blue-500 text-blue-600 flex-1 md:flex-none' : 'flex-1 md:flex-none'}
                    >
                        <Filter className="mr-2 h-4 w-4" />
                        Filtreler
                        {hasActiveFilters && (
                            <Badge className="ml-2 bg-blue-500">Aktif</Badge>
                        )}
                    </Button>
                    <Button variant="outline" className="flex-1 md:flex-none" onClick={() => navigate('/invoices/upload')}>
                        <Upload className="mr-2 h-4 w-4" />
                        PDF Yükle
                    </Button>
                    <Button className="w-full md:w-auto" onClick={() => navigate('/invoices/new')}>
                        <Plus className="mr-2 h-4 w-4" /> Yeni Fatura
                    </Button>
                </div>
            </div>

            {/* Filtre Paneli */}
            {showFilters && (
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="w-full md:w-48">
                                <Label className="text-xs">Fatura Tipi</Label>
                                <Select value={typeFilter || 'all'} onValueChange={(val) => setTypeFilter(val === 'all' ? '' : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        <SelectItem value="Sales">Gelir (Satış)</SelectItem>
                                        <SelectItem value="Purchase">Gider (Alış)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full md:w-48">
                                <Label className="text-xs">Ödeme Durumu</Label>
                                <Select value={paymentFilter || 'all'} onValueChange={(val) => setPaymentFilter(val === 'all' ? '' : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        <SelectItem value="Unpaid">Ödenmedi</SelectItem>
                                        <SelectItem value="Partial">Kısmi Ödendi</SelectItem>
                                        <SelectItem value="Paid">Ödendi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-full md:w-48">
                                <Label className="text-xs">Proje</Label>
                                <Select value={projectFilter || 'all'} onValueChange={(val) => setProjectFilter(val === 'all' ? '' : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tümü" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tümü</SelectItem>
                                        {projects?.map((project: any) => (
                                            <SelectItem key={project.id} value={project.id.toString()}>
                                                {project.code} - {project.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" className="w-full md:w-auto" onClick={clearFilters}>
                                    <X className="mr-1 h-4 w-4" /> Temizle
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Fatura Tablosu */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="whitespace-nowrap">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fatura No</TableHead>
                                <TableHead>Tip</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Cari</TableHead>
                                <TableHead>Proje</TableHead>
                                <TableHead className="text-right">Tutar</TableHead>
                                <TableHead>KDV Durumu</TableHead>
                                <TableHead>Ödeme</TableHead>
                                <TableHead>İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices?.map((invoice: Invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-mono font-medium">
                                        {invoice.invoice_no || `#${invoice.id}`}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {invoice.invoice_type === 'Sales' ? (
                                                <FileOutput className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <FileInput className="h-4 w-4 text-red-600" />
                                            )}
                                            <span className="text-sm">
                                                {invoiceTypeLabels[invoice.invoice_type] || invoice.invoice_type}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(invoice.issue_date).toLocaleDateString('tr-TR')}
                                    </TableCell>
                                    <TableCell>{getAccountTitle(invoice.account_id)}</TableCell>
                                    <TableCell>
                                        {invoice.project_id ? (
                                            <Badge variant="outline" className="font-mono">
                                                {getProjectCode(invoice.project_id)}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {formatCurrency(invoice.total_amount, invoice.currency)}
                                    </TableCell>
                                    <TableCell>
                                        {invoice.exempt_amount > 0 ? (
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700">
                                                <ShieldCheck className="h-3 w-3 mr-1" />
                                                KDV Muaf
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">Normal</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={paymentStatusColors[invoice.payment_status]}>
                                            {paymentStatusLabels[invoice.payment_status] || invoice.payment_status}
                                        </Badge>
                                        {invoice.payment_status !== 'Paid' && invoice.paid_amount > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {formatCurrency(invoice.paid_amount, invoice.currency)} ödendi
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setSelectedInvoice(invoice);
                                                    setIsDetailOpen(true);
                                                }}
                                                title="Görüntüle"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {invoice.payment_status !== 'Paid' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setSelectedInvoice(invoice);
                                                        setIsPaymentOpen(true);
                                                    }}
                                                    title={invoice.invoice_type === 'Sales' ? 'Tahsilat Al' : 'Ödeme Yap'}
                                                >
                                                    <CreditCard className="h-4 w-4 text-blue-600" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    const apiUrl = import.meta.env.VITE_API_URL || '/api';
                                                    const baseUrl = apiUrl.startsWith('http') ? apiUrl : window.location.origin + apiUrl;
                                                    window.open(`${baseUrl}/finance/invoices/${invoice.id}/pdf`, '_blank');
                                                }}
                                                title="PDF İndir"
                                            >
                                                <FileDown className="h-4 w-4 text-red-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteInvoice(invoice)}
                                                title="Fatura Sil"
                                                disabled={deleteInvoiceMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {invoices?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                        Henüz fatura bulunmuyor.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Fatura Detay Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-3xl" aria-describedby="invoice-detail-description">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Fatura: {selectedInvoice?.invoice_no || `#${selectedInvoice?.id}`}
                            <Badge className={paymentStatusColors[selectedInvoice?.payment_status || 'Unpaid']}>
                                {paymentStatusLabels[selectedInvoice?.payment_status || 'Unpaid']}
                            </Badge>
                            {(selectedInvoice?.exempt_amount ?? 0) > 0 && (
                                <Badge className="bg-emerald-600">
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    Teknokent KDV Muaf
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription id="invoice-detail-description" className="sr-only">
                            Fatura detayları ve kalemleri.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedInvoice && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Fatura Tipi:</span>
                                    <div className="font-medium">
                                        {invoiceTypeLabels[selectedInvoice.invoice_type]}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Cari:</span>
                                    <div className="font-medium">{getAccountTitle(selectedInvoice.account_id)}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Proje:</span>
                                    <div className="font-medium">{getProjectCode(selectedInvoice.project_id)}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tarih:</span>
                                    <div className="font-medium">
                                        {new Date(selectedInvoice.issue_date).toLocaleDateString('tr-TR')}
                                    </div>
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">Miktar</TableHead>
                                        <TableHead className="text-right">Birim Fiyat</TableHead>
                                        <TableHead className="text-right">KDV</TableHead>
                                        <TableHead className="text-right">Toplam</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedInvoice.items?.map((item: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                {item.description}
                                                {item.is_exempt && (
                                                    <Badge variant="outline" className="ml-2 text-xs">
                                                        İstisna
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(item.unit_price, selectedInvoice.currency)}
                                            </TableCell>
                                            <TableCell className="text-right">%{item.vat_rate}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(item.total_with_vat, selectedInvoice.currency)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <div className="flex justify-end">
                                <div className="w-72 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Ara Toplam:</span>
                                        <span>{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                                    </div>
                                    {selectedInvoice.exempt_amount > 0 && (
                                        <div className="flex justify-between text-emerald-600">
                                            <span>İstisna Matrah:</span>
                                            <span>{formatCurrency(selectedInvoice.exempt_amount, selectedInvoice.currency)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>KDV:</span>
                                        <span>{formatCurrency(selectedInvoice.vat_amount, selectedInvoice.currency)}</span>
                                    </div>
                                    {selectedInvoice.withholding_amount > 0 && (
                                        <div className="flex justify-between text-orange-600">
                                            <span>Tevkifat:</span>
                                            <span>-{formatCurrency(selectedInvoice.withholding_amount, selectedInvoice.currency)}</span>
                                        </div>
                                    )}
                                    <hr />
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>Genel Toplam:</span>
                                        <span>{formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-green-600">
                                        <span>Ödenen:</span>
                                        <span>{formatCurrency(selectedInvoice.paid_amount, selectedInvoice.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600 font-bold">
                                        <span>Kalan:</span>
                                        <span>{formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount, selectedInvoice.currency)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        {selectedInvoice?.payment_status !== 'Paid' && (
                            <Button onClick={() => {
                                setIsDetailOpen(false);
                                setIsPaymentOpen(true);
                            }}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                {selectedInvoice?.invoice_type === 'Sales' ? 'Tahsilat Al' : 'Ödeme Yap'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Ödeme/Tahsilat Modal */}
            < PaymentModal
                invoice={selectedInvoice}
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                onSuccess={handlePaymentSuccess}
            />
        </div >
    );
};

export default InvoiceList;
