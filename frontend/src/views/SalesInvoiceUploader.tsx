import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    FileWarning,
    Save,
    Plus,
    ArrowLeft,
    Users
} from 'lucide-react';

interface AccountInfo {
    name: string | null;
    tax_id: string | null;
    address: string | null;
    tax_office: string | null;
}

interface ParsedInvoice {
    ettn: string | null;
    invoice_no: string | null;
    issue_date: string | null;
    customer_name: string | null;
    customer_tax_id: string | null;
    customer_address: string | null;
    account_info: AccountInfo | null;
    gross_total: number | null;
    total_discount: number | null;
    net_subtotal: number | null;
    tax_amount: number | null;
    total_amount: number | null;
    verification_status: 'verified' | 'mismatch' | 'unverified';
    verification_notes: string[];
    lines: { description: string; quantity?: number; unit_price?: number; total?: number }[];
    notes: string[];
}

const SalesInvoiceUploader = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // State
    const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [accountId, setAccountId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [showNewAccountForm, setShowNewAccountForm] = useState(false);
    const [newAccountTitle, setNewAccountTitle] = useState('');
    const [newAccountTaxId, setNewAccountTaxId] = useState('');
    const [newAccountTaxOffice, setNewAccountTaxOffice] = useState('');
    const [newAccountAddress, setNewAccountAddress] = useState('');

    // Fetch accounts and projects
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/accounts')).data
    });

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => (await api.get('/projects')).data
    });

    const customerAccounts = accounts?.filter((a: { account_type: string }) =>
        a.account_type === 'customer' || a.account_type === 'both'
    );

    // Parse mutation - sends invoice_type=Sales for income invoices
    const parseInvoiceMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/finance/invoices/parse?invoice_type=Sales', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },
        onSuccess: (data) => {
            setParsedData(data);
        }
    });

    // Create invoice mutation
    const createInvoiceMutation = useMutation({
        mutationFn: async (invoice: unknown) => (await api.post('/finance/invoices', invoice)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            navigate('/invoices');
        }
    });

    // Create account mutation
    const createAccountMutation = useMutation({
        mutationFn: async (accountData: {
            title: string;
            tax_id?: string;
            tax_office?: string;
            address?: string;
            account_type: string;
        }) => (await api.post('/accounts', accountData)).data,
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setAccountId(response.id.toString());
            setShowNewAccountForm(false);
        }
    });

    // Auto-match account when parsed
    useEffect(() => {
        if (parsedData && accounts) {
            const accountInfo = parsedData.account_info;

            if (accountInfo?.tax_id) {
                const match = accounts.find((a: { tax_id?: string; id: number }) =>
                    a.tax_id === accountInfo.tax_id
                );
                if (match) {
                    setAccountId(match.id.toString());
                    setShowNewAccountForm(false);
                } else {
                    setShowNewAccountForm(true);
                    setNewAccountTitle(accountInfo.name || '');
                    setNewAccountTaxId(accountInfo.tax_id || '');
                    setNewAccountTaxOffice(accountInfo.tax_office || '');
                    setNewAccountAddress(accountInfo.address || '');
                }
            }
        }
    }, [parsedData, accounts]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setUploadedFileName(file.name);
            setParsedData(null);
            setAccountId('');
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
        setAccountId('');
        setProjectId('');
        setShowNewAccountForm(false);
    };

    const handleCreateAccount = () => {
        if (!newAccountTitle) return;
        createAccountMutation.mutate({
            title: newAccountTitle,
            tax_id: newAccountTaxId || undefined,
            tax_office: newAccountTaxOffice || undefined,
            address: newAccountAddress || undefined,
            account_type: 'customer'
        });
    };

    const handleSave = () => {
        if (!parsedData || !accountId) return;

        const items = parsedData.lines.map(line => ({
            description: line.description,
            quantity: line.quantity || 1,
            unit_price: line.unit_price || line.total || 0,
            vat_rate: 20,
            is_exempt: false,
            exemption_code: null
        }));

        createInvoiceMutation.mutate({
            invoice_type: 'Sales',
            invoice_no: parsedData.invoice_no || parsedData.ettn,
            account_id: parseInt(accountId),
            project_id: projectId ? parseInt(projectId) : null,
            issue_date: parsedData.issue_date,
            due_date: null,
            currency: 'TRY',
            items,
            notes: parsedData.notes.join('\n')
        });
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Geri
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Gelir Faturası Ekle</h1>
                    <p className="text-muted-foreground">Müşteriye kesilen fatura</p>
                </div>
            </div>

            {/* Step 1: Upload */}
            {!parsedData && (
                <Card>
                    <CardContent className="pt-6">
                        <div
                            {...getRootProps()}
                            className={`
                                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                                transition-all duration-200
                                ${isDragActive ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-muted-foreground/25'}
                                ${isDragReject ? 'border-red-500 bg-red-50' : ''}
                                hover:border-primary hover:bg-muted/50
                            `}
                        >
                            <input {...getInputProps()} />
                            {parseInvoiceMutation.isPending ? (
                                <div className="space-y-4">
                                    <RefreshCw className="mx-auto h-12 w-12 text-emerald-500 animate-spin" />
                                    <p className="text-lg font-medium">PDF analiz ediliyor...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <div>
                                        <p className="text-lg font-medium">PDF fatura dosyasını sürükleyin</p>
                                        <p className="text-sm text-muted-foreground">veya tıklayarak seçin</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {parseInvoiceMutation.isError && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                    <p className="text-red-600">PDF analiz edilemedi</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Review & Confirm */}
            {parsedData && (
                <div className="space-y-4">
                    {/* Success Header */}
                    <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                <div>
                                    <p className="font-medium text-emerald-700">PDF Analiz Edildi</p>
                                    <p className="text-sm text-emerald-600/70">{uploadedFileName}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleReset}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Farklı Dosya
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Invoice Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Fatura Bilgileri
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground">Fatura No</Label>
                                    <p className="font-medium">{parsedData.invoice_no || parsedData.ettn || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Tarih</Label>
                                    <p className="font-medium">{parsedData.issue_date || '-'}</p>
                                </div>
                            </div>

                            {/* Verification Status */}
                            <div className={`p-3 rounded-lg ${parsedData.verification_status === 'verified'
                                ? 'bg-emerald-50 border border-emerald-200'
                                : parsedData.verification_status === 'mismatch'
                                    ? 'bg-yellow-50 border border-yellow-200'
                                    : 'bg-gray-50 border border-gray-200'
                                }`}>
                                <div className="flex items-center gap-2">
                                    {parsedData.verification_status === 'verified' ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    ) : parsedData.verification_status === 'mismatch' ? (
                                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                                    ) : (
                                        <FileWarning className="h-5 w-5 text-gray-600" />
                                    )}
                                    <span className="font-medium">
                                        {parsedData.verification_status === 'verified' ? '✓ Tutarlar Doğrulandı' :
                                            parsedData.verification_status === 'mismatch' ? '⚠ Uyuşmazlık Var' : 'Doğrulanamadı'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                    {parsedData.gross_total && (
                                        <div>
                                            <span className="text-muted-foreground">Brüt:</span>
                                            <span className="ml-1 font-medium">{formatCurrency(parsedData.gross_total)}</span>
                                        </div>
                                    )}
                                    {parsedData.total_discount > 0 && (
                                        <div>
                                            <span className="text-muted-foreground">İskonto:</span>
                                            <span className="ml-1 font-medium text-red-600">-{formatCurrency(parsedData.total_discount)}</span>
                                        </div>
                                    )}
                                    {parsedData.total_amount && (
                                        <div>
                                            <span className="text-muted-foreground">Toplam:</span>
                                            <span className="ml-1 font-bold">{formatCurrency(parsedData.total_amount)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customer Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" /> Müşteri
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Detected Customer */}
                            {parsedData.account_info?.name && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200">
                                    <p className="font-medium">{parsedData.account_info.name}</p>
                                    {parsedData.account_info.tax_id && (
                                        <p className="text-sm text-muted-foreground">VKN: {parsedData.account_info.tax_id}</p>
                                    )}
                                    {parsedData.account_info.address && (
                                        <p className="text-sm text-muted-foreground">{parsedData.account_info.address}</p>
                                    )}
                                </div>
                            )}

                            {/* Account Selection */}
                            <div className="space-y-2">
                                <Label>Cari Hesap Seçin *</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={accountId}
                                    onChange={(e) => {
                                        setAccountId(e.target.value);
                                        if (e.target.value) setShowNewAccountForm(false);
                                    }}
                                >
                                    <option value="">Seçiniz...</option>
                                    {customerAccounts?.map((a: { id: number; title: string }) => (
                                        <option key={a.id} value={a.id}>{a.title}</option>
                                    ))}
                                </select>
                                {!accountId && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowNewAccountForm(!showNewAccountForm)}
                                    >
                                        <Plus className="h-4 w-4 mr-2" /> Yeni Müşteri Ekle
                                    </Button>
                                )}
                            </div>

                            {/* New Account Form */}
                            {showNewAccountForm && (
                                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                                    <h4 className="font-medium">Yeni Müşteri</h4>
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <Label>Firma Adı *</Label>
                                            <input
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={newAccountTitle}
                                                onChange={(e) => setNewAccountTitle(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>VKN</Label>
                                                <input
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={newAccountTaxId}
                                                    onChange={(e) => setNewAccountTaxId(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Vergi Dairesi</Label>
                                                <input
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={newAccountTaxOffice}
                                                    onChange={(e) => setNewAccountTaxOffice(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Adres</Label>
                                            <input
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={newAccountAddress}
                                                onChange={(e) => setNewAccountAddress(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleCreateAccount}
                                            disabled={!newAccountTitle || createAccountMutation.isPending}
                                        >
                                            <Plus className="h-4 w-4 mr-2" /> Müşteri Oluştur
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Project Selection */}
                            <div className="space-y-2">
                                <Label>Proje (Opsiyonel)</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                >
                                    <option value="">Proje yok</option>
                                    {projects?.map((p: { id: number; name: string; code: string }) => (
                                        <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line Items Summary */}
                    {parsedData.lines.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Kalemler ({parsedData.lines.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 max-h-48 overflow-auto">
                                    {parsedData.lines.map((line, i) => (
                                        <div key={i} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                                            <span className="truncate flex-1">{line.description}</span>
                                            <span className="font-medium ml-4">
                                                {line.total ? formatCurrency(line.total) :
                                                    line.quantity && line.unit_price ? formatCurrency(line.quantity * line.unit_price) : '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                        <Button variant="outline" onClick={handleReset}>
                            İptal
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!accountId || createInvoiceMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {createInvoiceMutation.isPending ? 'Kaydediliyor...' : 'Faturayı Kaydet'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesInvoiceUploader;
