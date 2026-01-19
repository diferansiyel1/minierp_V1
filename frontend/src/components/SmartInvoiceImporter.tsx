import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Save, Plus, X } from 'lucide-react';

interface SmartInvoiceImporterProps {
    forcedType?: 'Sales' | 'Purchase';
    onUploadSuccess?: () => void;
    onClose?: () => void;
}

interface ParsedInvoice {
    ettn: string | null;
    invoice_no: string | null;
    issue_date: string | null;
    issuer_name: string | null;
    issuer_tax_id: string | null;
    customer_name: string | null;
    total_amount: number | null;
    tax_amount: number | null;
    invoice_type: string;
    suggested_category: string | null;
    suggested_withholding_rate: number;
    suggested_expense_center: string | null;
    is_technopark_expense: boolean;
    vat_exempt: boolean;
    lines: { description: string; quantity?: number; unit_price?: number; vat_rate?: number }[];
    notes: string[];
}

interface InvoiceItem {
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    is_exempt: boolean;
    exemption_code: string | null;
}

const SmartInvoiceImporter: React.FC<SmartInvoiceImporterProps> = ({ forcedType, onUploadSuccess, onClose }) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<'upload' | 'confirm' | 'form'>('upload');
    const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
    const [fileName, setFileName] = useState('');

    const [invoiceType, setInvoiceType] = useState<'Sales' | 'Purchase'>(forcedType || 'Purchase');
    const [accountId, setAccountId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('');
    const [expenseCenter, setExpenseCenter] = useState('');
    const [items, setItems] = useState<InvoiceItem[]>([]);

    const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: async () => (await api.get('/accounts/')).data });
    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const res = await api.get('/projects');
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const parseMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return (await api.post('/finance/invoices/parse', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
        },
        onSuccess: (data) => { setParsedData(data); setStep('confirm'); }
    });

    const createMutation = useMutation({
        mutationFn: async (invoice: any) => api.post('/finance/invoices', invoice),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['expense-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            onUploadSuccess?.();
        }
    });

    useEffect(() => {
        if (parsedData) {
            setInvoiceType(forcedType || (parsedData.invoice_type === 'Sales' ? 'Sales' : 'Purchase'));
            setIssueDate(parsedData.issue_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
            if (parsedData.suggested_category) setExpenseCategory(parsedData.suggested_category);
            if (parsedData.suggested_expense_center) setExpenseCenter(parsedData.suggested_expense_center);

            const party = invoiceType === 'Purchase' ? parsedData.issuer_name : parsedData.customer_name;
            if (party && accounts) {
                const match = accounts.find((a: any) => a.title.toLowerCase().includes(party.toLowerCase().substring(0, 10)));
                if (match) setAccountId(match.id.toString());
            }

            setItems(parsedData.lines.map(l => ({
                description: l.description,
                quantity: l.quantity || 1,
                unit_price: l.unit_price || 0,
                vat_rate: l.vat_rate || (parsedData.vat_exempt ? 0 : 20),
                is_exempt: parsedData.vat_exempt,
                exemption_code: parsedData.vat_exempt ? '3065 G.20/1' : null
            })));

            if (parsedData.lines.length === 0) {
                setItems([{ description: 'Fatura kalemi', quantity: 1, unit_price: parsedData.total_amount || 0, vat_rate: parsedData.vat_exempt ? 0 : 20, is_exempt: parsedData.vat_exempt, exemption_code: null }]);
            }
        }
    }, [parsedData, accounts, forcedType, invoiceType]);

    const onDrop = useCallback((files: File[]) => {
        if (files.length > 0) { setFileName(files[0].name); parseMutation.mutate(files[0]); }
    }, [parseMutation]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1 });

    const formatCurrency = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const vatTotal = items.reduce((s, i) => s + (i.is_exempt ? 0 : i.quantity * i.unit_price * i.vat_rate / 100), 0);

    const handleSave = () => {
        if (!accountId) { alert('Lütfen bir cari hesap seçin.'); return; }
        createMutation.mutate({
            invoice_type: invoiceType,
            invoice_no: parsedData?.ettn || null,
            account_id: parseInt(accountId),
            project_id: projectId ? parseInt(projectId) : null,
            currency: 'TRY',
            issue_date: issueDate ? new Date(issueDate).toISOString() : null,
            expense_category: invoiceType === 'Purchase' ? expenseCategory || null : null,
            expense_center: invoiceType === 'Purchase' ? expenseCenter || null : null,
            items: items.map(i => ({ product_id: null, description: i.description, quantity: i.quantity, unit_price: i.unit_price, vat_rate: i.vat_rate, withholding_rate: 0, is_exempt: i.is_exempt, exemption_code: i.exemption_code }))
        });
    };

    const filteredAccounts = accounts?.filter((a: any) => invoiceType === 'Sales' ? ['Customer', 'Both'].includes(a.account_type) : ['Supplier', 'Both'].includes(a.account_type));
    const categoryLabel = { RENT: 'Kira', HARDWARE: 'Donanım', SOFTWARE: 'Yazılım', CONSULTANCY: 'Danışmanlık', OTHER: 'Diğer' };

    return (
        <Dialog open={true} onOpenChange={() => onClose?.()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="smart-invoice-importer-description">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {forcedType === 'Sales' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <FileText className="h-5 w-5 text-red-600" />}
                        {forcedType === 'Sales' ? 'Satış Faturası Yükle' : forcedType === 'Purchase' ? 'Gider Faturası Yükle' : 'Fatura Yükle'}
                    </DialogTitle>
                    <DialogDescription id="smart-invoice-importer-description" className="sr-only">PDF fatura yükleyerek otomatik analiz yapın.</DialogDescription>
                </DialogHeader>

                {step === 'upload' && (
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25 hover:border-blue-400'} ${parseMutation.isPending ? 'opacity-60' : ''}`}>
                        <input {...getInputProps()} />
                        {parseMutation.isPending ? (
                            <div><RefreshCw className="mx-auto h-10 w-10 text-blue-600 animate-spin" /><p className="mt-4 text-blue-600 font-medium">PDF Analiz Ediliyor...</p><p className="text-sm text-muted-foreground">{fileName}</p></div>
                        ) : parseMutation.isError ? (
                            <div><AlertCircle className="mx-auto h-10 w-10 text-red-500" /><p className="mt-4 text-red-600">PDF analiz edilemedi</p><Button variant="outline" size="sm" className="mt-2" onClick={() => parseMutation.reset()}>Tekrar Dene</Button></div>
                        ) : (
                            <div><Upload className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 font-medium">PDF fatura dosyasını sürükleyin</p><p className="text-sm text-muted-foreground">veya tıklayarak seçin</p></div>
                        )}
                    </div>
                )}

                {step === 'confirm' && parsedData && (
                    <div className="space-y-4">
                        <Card className={`border-2 ${invoiceType === 'Sales' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                            <CardContent className="p-4 text-center">
                                <p className="text-lg font-bold">{invoiceType === 'Sales' ? '📈 SATIŞ FATURASI' : '📉 GİDER FATURASI'}</p>
                                <p className="text-3xl font-bold mt-2">{formatCurrency(parsedData.total_amount || 0)}</p>
                                {parsedData.suggested_category && <Badge className="mt-2">{categoryLabel[parsedData.suggested_category as keyof typeof categoryLabel] || parsedData.suggested_category}</Badge>}
                                {parsedData.is_technopark_expense && <Badge className="mt-2 ml-2 bg-purple-600">Teknokent</Badge>}
                                <p className="text-sm text-muted-foreground mt-2">{invoiceType === 'Purchase' ? parsedData.issuer_name : parsedData.customer_name}</p>
                            </CardContent>
                        </Card>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setStep('upload'); setParsedData(null); }}>İptal</Button>
                            <Button className="flex-1" onClick={() => setStep('form')}>Onayla ve Düzenle</Button>
                        </div>
                    </div>
                )}

                {step === 'form' && parsedData && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>{invoiceType === 'Sales' ? 'Müşteri' : 'Tedarikçi'} *</Label>
                                <Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger><SelectContent>{filteredAccounts?.map((a: any) => <SelectItem key={a.id} value={a.id.toString()}>{a.title}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div><Label>Fatura Tarihi</Label><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
                            <div><Label>Proje</Label>
                                <Select value={projectId} onValueChange={(val) => setProjectId(val === 'none' ? '' : val)}><SelectTrigger><SelectValue placeholder="(Opsiyonel)" /></SelectTrigger><SelectContent><SelectItem value="none">Seçilmedi</SelectItem>{projects?.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.code}</SelectItem>)}</SelectContent></Select>
                            </div>
                            {invoiceType === 'Purchase' && (
                                <div><Label>Gider Kategorisi</Label>
                                    <Select value={expenseCategory} onValueChange={setExpenseCategory}><SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger><SelectContent><SelectItem value="Kira">Kira</SelectItem><SelectItem value="Donanım">Donanım</SelectItem><SelectItem value="Yazılım">Yazılım</SelectItem><SelectItem value="Danışmanlık">Danışmanlık</SelectItem><SelectItem value="Diğer">Diğer</SelectItem></SelectContent></Select>
                                </div>
                            )}
                        </div>
                        <Card><CardHeader className="py-2"><CardTitle className="text-sm">Fatura Kalemleri</CardTitle></CardHeader><CardContent className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <Input className="flex-1" value={item.description} onChange={e => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} placeholder="Açıklama" />
                                    <Input className="w-20" type="number" value={item.quantity} onChange={e => { const n = [...items]; n[idx].quantity = parseFloat(e.target.value) || 0; setItems(n); }} />
                                    <Input className="w-28" type="number" value={item.unit_price} onChange={e => { const n = [...items]; n[idx].unit_price = parseFloat(e.target.value) || 0; setItems(n); }} />
                                    <Input className="w-16" type="number" value={item.vat_rate} onChange={e => { const n = [...items]; n[idx].vat_rate = parseInt(e.target.value) || 0; setItems(n); }} />
                                    <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: '', quantity: 1, unit_price: 0, vat_rate: 20, is_exempt: false, exemption_code: null }])}><Plus className="mr-2 h-4 w-4" />Satır Ekle</Button>
                        </CardContent></Card>
                        <div className="text-right space-y-1">
                            <p className="text-sm">Ara Toplam: {formatCurrency(subtotal)}</p>
                            <p className="text-sm">KDV: {formatCurrency(vatTotal)}</p>
                            <p className="text-xl font-bold">Toplam: {formatCurrency(subtotal + vatTotal)}</p>
                        </div>
                    </div>
                )}

                {step === 'form' && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStep('confirm')}>Geri</Button>
                        <Button onClick={handleSave} disabled={createMutation.isPending || !accountId}><Save className="mr-2 h-4 w-4" />{createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default SmartInvoiceImporter;
