import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    FileWarning,
    Save,
    Plus,
    Trash2
} from 'lucide-react';

interface InvoiceLineItem {
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    is_exempt: boolean;
    exemption_code: string | null;
    line_total: number;
    vat_amount: number;
    total_with_vat: number;
}

interface ParsedInvoice {
    // Invoice ID
    ettn: string | null;
    invoice_no: string | null;
    issue_date: string | null;

    // Issuer (Faturayı Kesen)
    issuer_name: string | null;
    issuer_tax_id: string | null;
    issuer_address: string | null;
    issuer_tax_office: string | null;

    // Customer (Alıcı)
    customer_name: string | null;
    customer_tax_id: string | null;
    customer_address: string | null;
    customer_tax_office: string | null;

    // Legacy fields
    supplier_name: string | null;
    receiver_name: string | null;
    tax_id: string | null;
    tax_office: string | null;
    address: string | null;

    // Totals
    gross_total: number | null;
    total_discount: number | null;
    net_subtotal: number | null;
    tax_amount: number | null;
    total_amount: number | null;

    // Verification
    verification_status: 'verified' | 'mismatch' | 'unverified';
    verification_notes: string[];

    // Classification
    invoice_type: string;
    suggested_project_code: string | null;
    is_technopark_expense: boolean;
    expense_type: string | null;
    vat_exempt: boolean;

    // Data
    lines: {
        description: string;
        quantity?: number;
        unit_price?: number;
        vat_rate?: number;
        discount_rate?: number;
        discount_amount?: number;
        total?: number;
    }[];
    notes: string[];
    raw_text: string | null;
}

const InvoiceUploader = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Upload state
    const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');

    // Editable form state
    const [invoiceType, setInvoiceType] = useState<'Sales' | 'Purchase'>('Purchase');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [accountId, setAccountId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [currency, setCurrency] = useState('TRY');
    const [items, setItems] = useState<InvoiceLineItem[]>([]);
    const [notes, setNotes] = useState('');

    // New account form state
    const [showNewAccountForm, setShowNewAccountForm] = useState(false);
    const [newAccountTitle, setNewAccountTitle] = useState('');
    const [newAccountTaxId, setNewAccountTaxId] = useState('');
    const [newAccountTaxOffice, setNewAccountTaxOffice] = useState('');
    const [newAccountAddress, setNewAccountAddress] = useState('');

    // Fetch accounts and projects
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/accounts/')).data
    });

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const res = await api.get('/projects');
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    // Parse PDF mutation
    const parseInvoiceMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/finance/invoices/parse', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        },
        onSuccess: (data) => {
            setParsedData(data);
        },
        onError: (error: unknown) => {
            console.error('Parse error:', error);
        }
    });

    // Create invoice mutation
    const createInvoiceMutation = useMutation({
        mutationFn: async (invoice: any) => api.post('/finance/invoices', invoice),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            alert('Fatura başarıyla kaydedildi!');
            navigate('/invoices');
        },
        onError: (error: unknown) => {
            console.error('Save error:', error);
            alert('Fatura kaydedilemedi. Lütfen tüm alanları kontrol edin.');
        }
    });

    // Create new account mutation
    const createAccountMutation = useMutation({
        mutationFn: async (accountData: {
            title: string;
            tax_id?: string;
            tax_office?: string;
            address?: string;
            account_type: string;
        }) => {
            return api.post('/accounts/', accountData);
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setAccountId(response.data.id.toString());
            setShowNewAccountForm(false);
            alert('Cari kart oluşturuldu!');
        },
        onError: () => {
            alert('Cari kart oluşturulamadı.');
        }
    });

    // Handle creating new account
    const handleCreateAccount = () => {
        if (!newAccountTitle) {
            alert('Lütfen cari unvanını girin.');
            return;
        }
        createAccountMutation.mutate({
            title: newAccountTitle,
            tax_id: newAccountTaxId || undefined,
            tax_office: newAccountTaxOffice || undefined,
            address: newAccountAddress || undefined,
            account_type: invoiceType === 'Sales' ? 'Customer' : 'Supplier'
        });
    };

    // Initialize form from parsed data
    useEffect(() => {
        if (parsedData) {
            setInvoiceType(parsedData.invoice_type === 'Sales' ? 'Sales' : 'Purchase');
            setIssueDate(parsedData.issue_date ? parsedData.issue_date.split('T')[0] : new Date().toISOString().split('T')[0]);

            // Convert parsed lines to editable items
            const parsedItems: InvoiceLineItem[] = parsedData.lines.map(line => {
                const quantity = line.quantity || 1;
                const unitPrice = line.unit_price || 0;
                const vatRate = line.vat_rate || (parsedData.vat_exempt ? 0 : 20);
                const lineTotal = quantity * unitPrice;
                const vatAmount = lineTotal * (vatRate / 100);

                return {
                    description: line.description,
                    quantity,
                    unit_price: unitPrice,
                    vat_rate: vatRate,
                    is_exempt: parsedData.vat_exempt,
                    exemption_code: parsedData.vat_exempt ? '3065 G.20/1' : null,
                    line_total: lineTotal,
                    vat_amount: vatAmount,
                    total_with_vat: lineTotal + vatAmount
                };
            });

            // If no lines parsed, add one default line
            if (parsedItems.length === 0) {
                parsedItems.push({
                    description: 'Fatura kalemi',
                    quantity: 1,
                    unit_price: parsedData.total_amount || 0,
                    vat_rate: parsedData.vat_exempt ? 0 : 20,
                    is_exempt: parsedData.vat_exempt,
                    exemption_code: parsedData.vat_exempt ? '3065 G.20/1' : null,
                    line_total: parsedData.total_amount || 0,
                    vat_amount: parsedData.tax_amount || 0,
                    total_with_vat: (parsedData.total_amount || 0) + (parsedData.tax_amount || 0)
                });
            }

            setItems(parsedItems);
            setNotes(parsedData.notes.join('\n'));

            // Try to match project by code
            if (parsedData.suggested_project_code && projects) {
                const match = projects.find((p: { code: string; id: number }) =>
                    p.code === parsedData.suggested_project_code
                );
                if (match) setProjectId(match.id.toString());
            }

            // Determine which party we need to create/match as account
            // For Purchase: supplier/issuer is the account (who we pay)
            // For Sales: customer is the account (who pays us)
            const accountParty = parsedData.invoice_type === 'Purchase' ? {
                name: parsedData.issuer_name || parsedData.supplier_name,
                tax_id: parsedData.issuer_tax_id,
                tax_office: parsedData.issuer_tax_office,
                address: parsedData.issuer_address
            } : {
                name: parsedData.customer_name || parsedData.receiver_name,
                tax_id: parsedData.customer_tax_id,
                tax_office: parsedData.customer_tax_office,
                address: parsedData.customer_address
            };

            // Try to auto-match account by VKN (tax_id)
            if (accounts && accountParty.tax_id) {
                const matchByVkn = accounts.find((a: { tax_id?: string; id: number }) =>
                    a.tax_id === accountParty.tax_id
                );
                if (matchByVkn) {
                    setAccountId(matchByVkn.id.toString());
                    setShowNewAccountForm(false);
                } else {
                    // VKN found but no match - suggest creating new account
                    setShowNewAccountForm(true);
                    setNewAccountTitle(accountParty.name || '');
                    setNewAccountTaxId(accountParty.tax_id || '');
                    setNewAccountTaxOffice(accountParty.tax_office || '');
                    setNewAccountAddress(accountParty.address || '');
                }
            } else if (accountParty.name) {
                // No VKN but have name - try to match by name
                const matchByName = accounts?.find((a: { title: string; id: number }) =>
                    a.title.toLowerCase().includes(accountParty.name!.toLowerCase().substring(0, 15))
                );
                if (matchByName) {
                    setAccountId(matchByName.id.toString());
                } else {
                    // Suggest creating new
                    setShowNewAccountForm(true);
                    setNewAccountTitle(accountParty.name);
                    setNewAccountTaxId(accountParty.tax_id || parsedData.tax_id || '');
                    setNewAccountTaxOffice(accountParty.tax_office || parsedData.tax_office || '');
                    setNewAccountAddress(accountParty.address || parsedData.address || '');
                }
            }
        }
    }, [parsedData, projects, accounts]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setUploadedFileName(file.name);
            setParsedData(null);
            setItems([]);
            setAccountId('');
            setProjectId('');
            parseInvoiceMutation.mutate(file);
        }
    }, [parseInvoiceMutation]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        multiple: false
    });

    const handleReset = () => {
        setParsedData(null);
        setUploadedFileName('');
        setItems([]);
        setAccountId('');
        setProjectId('');
        setInvoiceNo('');
        setNotes('');
        parseInvoiceMutation.reset();
    };

    // Item management
    const addItem = () => {
        setItems([...items, {
            description: '',
            quantity: 1,
            unit_price: 0,
            vat_rate: 20,
            is_exempt: false,
            exemption_code: null,
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

    const updateItem = (index: number, field: string, value: unknown) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        // Recalculate totals
        const lineTotal = item.quantity * item.unit_price;
        const vatAmount = item.is_exempt ? 0 : lineTotal * (item.vat_rate / 100);
        item.line_total = lineTotal;
        item.vat_amount = vatAmount;
        item.total_with_vat = lineTotal + vatAmount;

        if (field === 'is_exempt') {
            item.exemption_code = value ? '3065 G.20/1' : null;
            if (value) item.vat_rate = 0;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    // Calculations
    const calculateSubtotal = () => items.reduce((acc, item) => acc + item.line_total, 0);
    const calculateVat = () => items.reduce((acc, item) => acc + item.vat_amount, 0);
    const calculateTotal = () => calculateSubtotal() + calculateVat();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
    };

    // Save invoice
    const handleSave = () => {
        if (!accountId) {
            alert('Lütfen bir cari hesap seçin.');
            return;
        }
        if (items.length === 0) {
            alert('Lütfen en az bir fatura kalemi ekleyin.');
            return;
        }

        const invoice = {
            invoice_type: invoiceType,
            invoice_no: invoiceNo || parsedData?.ettn || null,
            account_id: parseInt(accountId),
            project_id: projectId ? parseInt(projectId) : null,
            currency,
            issue_date: issueDate ? new Date(issueDate).toISOString() : null,
            notes,
            items: items.map(item => ({
                product_id: null,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                vat_rate: item.vat_rate,
                withholding_rate: 0,
                is_exempt: item.is_exempt,
                exemption_code: item.exemption_code,
                original_vat_rate: item.is_exempt ? 20 : item.vat_rate
            }))
        };

        createInvoiceMutation.mutate(invoice);
    };

    // Filter accounts by invoice type
    const filteredAccounts = accounts?.filter((a: { account_type: string }) => {
        if (invoiceType === 'Sales') {
            return a.account_type === 'Customer' || a.account_type === 'Both';
        }
        return a.account_type === 'Supplier' || a.account_type === 'Both';
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Fatura İçeri Aktar</h2>
                <p className="text-muted-foreground">
                    PDF fatura yükleyin, bilgileri düzenleyin ve kaydedin
                </p>
            </div>

            {/* Dropzone - Only show when no parsed data */}
            {!parsedData && (
                <Card>
                    <CardContent className="p-8">
                        <div
                            {...getRootProps()}
                            className={`
                                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                                transition-all duration-200
                                ${isDragActive && !isDragReject
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                    : isDragReject
                                        ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                                        : 'border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/50'
                                }
                                ${parseInvoiceMutation.isPending ? 'pointer-events-none opacity-60' : ''}
                            `}
                        >
                            <input {...getInputProps()} />

                            {parseInvoiceMutation.isPending ? (
                                <div className="space-y-4">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                                    </div>
                                    <p className="text-lg font-medium text-blue-600">PDF Analiz Ediliyor...</p>
                                    <p className="text-sm text-muted-foreground">{uploadedFileName}</p>
                                </div>
                            ) : isDragReject ? (
                                <div className="space-y-4">
                                    <FileWarning className="mx-auto h-12 w-12 text-red-500" />
                                    <p className="text-lg font-medium text-red-600">Sadece PDF dosyaları kabul edilir</p>
                                </div>
                            ) : isDragActive ? (
                                <div className="space-y-4">
                                    <Upload className="mx-auto h-12 w-12 text-blue-500 animate-bounce" />
                                    <p className="text-lg font-medium text-blue-600">Dosyayı buraya bırakın...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <div>
                                        <p className="text-lg font-medium">PDF fatura dosyasını sürükleyip bırakın</p>
                                        <p className="text-sm text-muted-foreground">veya tıklayarak seçin</p>
                                    </div>
                                    <Badge variant="outline">Sadece .PDF dosyaları</Badge>
                                </div>
                            )}
                        </div>

                        {parseInvoiceMutation.isError && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-red-600">PDF analiz edilemedi</p>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={handleReset}>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Tekrar Dene
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Editable Form - Show after parsing */}
            {parsedData && (
                <div className="space-y-6">
                    {/* Success Header */}
                    <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                <div>
                                    <p className="font-medium text-green-700">PDF Analiz Edildi</p>
                                    <p className="text-sm text-green-600/70">{uploadedFileName}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleReset}>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Invoice Parties & Verification Info */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Issuer Info */}
                        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                            <CardContent className="p-4">
                                <p className="text-sm font-medium text-blue-700 mb-2">Faturayı Kesen</p>
                                <p className="font-semibold">{parsedData.issuer_name || 'Bilinmiyor'}</p>
                                {parsedData.issuer_tax_id && (
                                    <p className="text-sm text-muted-foreground">VKN: {parsedData.issuer_tax_id}</p>
                                )}
                                {parsedData.issuer_address && (
                                    <p className="text-xs text-muted-foreground mt-1">{parsedData.issuer_address}</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Verification Status */}
                        <Card className={`border-${parsedData.verification_status === 'verified' ? 'green' : parsedData.verification_status === 'mismatch' ? 'yellow' : 'gray'}-200 bg-${parsedData.verification_status === 'verified' ? 'green' : parsedData.verification_status === 'mismatch' ? 'yellow' : 'gray'}-50/50 dark:bg-${parsedData.verification_status === 'verified' ? 'green' : parsedData.verification_status === 'mismatch' ? 'yellow' : 'gray'}-950/20`}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    {parsedData.verification_status === 'verified' ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    ) : parsedData.verification_status === 'mismatch' ? (
                                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                                    ) : (
                                        <FileWarning className="h-5 w-5 text-gray-600" />
                                    )}
                                    <span className={`font-medium ${parsedData.verification_status === 'verified' ? 'text-green-700' : parsedData.verification_status === 'mismatch' ? 'text-yellow-700' : 'text-gray-700'}`}>
                                        {parsedData.verification_status === 'verified' ? 'Tutarlar Doğrulandı' :
                                            parsedData.verification_status === 'mismatch' ? 'Uyuşmazlık Var!' : 'Doğrulanamadı'}
                                    </span>
                                </div>
                                {parsedData.total_discount != null && parsedData.total_discount > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Toplam İskonto: <span className="font-medium text-red-600">{formatCurrency(parsedData.total_discount)}</span>
                                    </p>
                                )}
                                {parsedData.verification_notes?.map((note, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">{note}</p>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Form Fields */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Fatura Bilgileri</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Invoice Type */}
                                    <div className="space-y-2">
                                        <Label>Fatura Tipi</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={invoiceType}
                                            onChange={(e) => setInvoiceType(e.target.value as 'Sales' | 'Purchase')}
                                        >
                                            <option value="Purchase">Gider (Alış)</option>
                                            <option value="Sales">Gelir (Satış)</option>
                                        </select>
                                    </div>

                                    {/* Account */}
                                    <div className="space-y-2">
                                        <Label>{invoiceType === 'Sales' ? 'Müşteri' : 'Tedarikçi'} *</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={accountId}
                                            onChange={(e) => {
                                                setAccountId(e.target.value);
                                                if (e.target.value) setShowNewAccountForm(false);
                                            }}
                                        >
                                            <option value="">Seçiniz...</option>
                                            {filteredAccounts?.map((a: { id: number; title: string }) => (
                                                <option key={a.id} value={a.id}>{a.title}</option>
                                            ))}
                                        </select>
                                        {!accountId && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowNewAccountForm(!showNewAccountForm)}
                                                className="w-full mt-1"
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                {showNewAccountForm ? 'Formu Gizle' : 'Yeni Cari Oluştur'}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Invoice No / ETTN */}
                                    <div className="space-y-2">
                                        <Label>Fatura No / ETTN</Label>
                                        <Input
                                            value={invoiceNo || parsedData.ettn || ''}
                                            onChange={(e) => setInvoiceNo(e.target.value)}
                                            placeholder="Fatura numarası veya ETTN"
                                        />
                                    </div>

                                    {/* Issue Date */}
                                    <div className="space-y-2">
                                        <Label>Fatura Tarihi</Label>
                                        <Input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                    </div>

                                    {/* Project */}
                                    <div className="space-y-2">
                                        <Label>Proje</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={projectId}
                                            onChange={(e) => setProjectId(e.target.value)}
                                        >
                                            <option value="">Proje seçin (opsiyonel)</option>
                                            {projects?.map((p: { id: number; code: string; name: string }) => (
                                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Currency */}
                                    <div className="space-y-2">
                                        <Label>Para Birimi</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value)}
                                        >
                                            <option value="TRY">₺ TRY</option>
                                            <option value="EUR">€ EUR</option>
                                            <option value="USD">$ USD</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label>Notlar</Label>
                                    <textarea
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Fatura notları..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* New Account Form - Collapsible */}
                        {showNewAccountForm && (
                            <Card className="md:col-span-2 border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Yeni Cari Kart Oluştur
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Unvan *</Label>
                                            <Input
                                                value={newAccountTitle}
                                                onChange={(e) => setNewAccountTitle(e.target.value)}
                                                placeholder="Firma unvanı"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>VKN (Vergi Kimlik No)</Label>
                                            <Input
                                                value={newAccountTaxId}
                                                onChange={(e) => setNewAccountTaxId(e.target.value)}
                                                placeholder="10-11 haneli VKN"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Vergi Dairesi</Label>
                                            <Input
                                                value={newAccountTaxOffice}
                                                onChange={(e) => setNewAccountTaxOffice(e.target.value)}
                                                placeholder="Vergi dairesi adı"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Adres</Label>
                                            <Input
                                                value={newAccountAddress}
                                                onChange={(e) => setNewAccountAddress(e.target.value)}
                                                placeholder="Firma adresi"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleCreateAccount}
                                            disabled={createAccountMutation.isPending || !newAccountTitle}
                                            className="flex-1"
                                        >
                                            <Save className="mr-2 h-4 w-4" />
                                            {createAccountMutation.isPending ? 'Oluşturuluyor...' : 'Cari Kartı Oluştur'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowNewAccountForm(false)}
                                        >
                                            İptal
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Özet</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Ara Toplam:</span>
                                    <span>{formatCurrency(calculateSubtotal())}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">KDV:</span>
                                    <span>{formatCurrency(calculateVat())}</span>
                                </div>
                                <hr />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Toplam:</span>
                                    <span className={invoiceType === 'Sales' ? 'text-green-600' : 'text-red-600'}>
                                        {formatCurrency(calculateTotal())}
                                    </span>
                                </div>

                                <Button
                                    className="w-full mt-4"
                                    size="lg"
                                    onClick={handleSave}
                                    disabled={createInvoiceMutation.isPending || !accountId}
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    {createInvoiceMutation.isPending ? 'Kaydediliyor...' : 'Faturayı Kaydet'}
                                </Button>

                                <Button variant="outline" className="w-full" onClick={handleReset}>
                                    İptal
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Line Items */}
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
                                        <TableHead className="w-[40%]">Açıklama</TableHead>
                                        <TableHead>Miktar</TableHead>
                                        <TableHead>Birim Fiyat</TableHead>
                                        <TableHead>KDV %</TableHead>
                                        <TableHead>Muaf</TableHead>
                                        <TableHead>Toplam</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, index) => (
                                        <TableRow key={index}>
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
                                                    className="w-28"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <select
                                                    className="bg-transparent border rounded px-2 py-1 text-sm w-16"
                                                    value={item.vat_rate}
                                                    onChange={(e) => updateItem(index, 'vat_rate', parseInt(e.target.value))}
                                                    disabled={item.is_exempt}
                                                >
                                                    <option value={0}>0</option>
                                                    <option value={1}>1</option>
                                                    <option value={10}>10</option>
                                                    <option value={20}>20</option>
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={item.is_exempt}
                                                    onChange={(e) => updateItem(index, 'is_exempt', e.target.checked)}
                                                    className="w-4 h-4"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
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
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Henüz kalem yok. "Satır Ekle" butonuna tıklayın.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default InvoiceUploader;
