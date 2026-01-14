import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, XCircle, AlertCircle, Building2, Users, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ImportResult {
    success: boolean;
    created: number;
    updated: number;
    errors: string[];
    total_errors: number;
}

const CsvImport = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'accounts' | 'contacts'>('accounts');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const importAccountsMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/import/accounts', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data as ImportResult;
        },
        onSuccess: (data) => {
            setResult(data);
            if (data.created > 0 || data.updated > 0) {
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
            }
        },
        onError: (error: any) => {
            setResult({
                success: false,
                created: 0,
                updated: 0,
                errors: [error.response?.data?.detail || 'Import başarısız oldu'],
                total_errors: 1
            });
        }
    });

    const importContactsMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/import/contacts', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data as ImportResult;
        },
        onSuccess: (data) => {
            setResult(data);
            if (data.created > 0 || data.updated > 0) {
                queryClient.invalidateQueries({ queryKey: ['contacts'] });
                queryClient.invalidateQueries({ queryKey: ['accounts'] });
            }
        },
        onError: (error: any) => {
            setResult({
                success: false,
                created: 0,
                updated: 0,
                errors: [error.response?.data?.detail || 'Import başarısız oldu'],
                total_errors: 1
            });
        }
    });

    const handleFileUpload = (file: File) => {
        setResult(null);
        if (activeTab === 'accounts') {
            importAccountsMutation.mutate(file);
        } else {
            importContactsMutation.mutate(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleFileUpload(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => {
        setDragActive(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    const isLoading = importAccountsMutation.isPending || importContactsMutation.isPending;

    const downloadTemplate = async (type: 'accounts' | 'contacts') => {
        try {
            const response = await api.get(`/import/template/${type}`);
            const data = response.data;

            // Create CSV content
            const headers = data.columns.join(',');
            const sampleRow = data.columns.map((col: string) => data.sample_row[col] || '').join(',');
            const csvContent = `${headers}\n${sampleRow}`;

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vtiger_${type}_template.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            alert('Şablon indirilemedi');
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">CSV Import</h2>
                <p className="text-muted-foreground mt-2">
                    vTiger CRM 7.5'ten export edilmiş CSV dosyalarını sisteme aktarın
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Import Panel */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Veri Import</CardTitle>
                            <CardDescription>
                                Önce Cari Hesapları, sonra İlgili Kişileri import etmeniz önerilir.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setResult(null); }}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="accounts" className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" /> Cari Hesaplar
                                    </TabsTrigger>
                                    <TabsTrigger value="contacts" className="flex items-center gap-2">
                                        <Users className="h-4 w-4" /> İlgili Kişiler
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="accounts" className="mt-6">
                                    <DropZone
                                        dragActive={dragActive}
                                        isLoading={isLoading}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onFileSelect={handleFileSelect}
                                        title="vTiger Organizations CSV"
                                        description="accountid, accountname, phone, email1, bill_street..."
                                    />
                                </TabsContent>

                                <TabsContent value="contacts" className="mt-6">
                                    <DropZone
                                        dragActive={dragActive}
                                        isLoading={isLoading}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onFileSelect={handleFileSelect}
                                        title="vTiger Contacts CSV"
                                        description="contactid, firstname, lastname, email, phone, accountid..."
                                    />
                                </TabsContent>
                            </Tabs>

                            {/* Result */}
                            {result && (
                                <div className={`mt-6 p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        {result.success ? (
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-600" />
                                        )}
                                        <span className="font-semibold">
                                            {result.success ? 'Import Tamamlandı' : 'Import Başarısız'}
                                        </span>
                                    </div>

                                    <div className="flex gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Oluşturulan:</span>
                                            <Badge className="ml-2 bg-green-600">{result.created}</Badge>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Güncellenen:</span>
                                            <Badge className="ml-2 bg-blue-600">{result.updated}</Badge>
                                        </div>
                                        {result.total_errors > 0 && (
                                            <div>
                                                <span className="text-muted-foreground">Hata:</span>
                                                <Badge className="ml-2 bg-red-600">{result.total_errors}</Badge>
                                            </div>
                                        )}
                                    </div>

                                    {result.errors.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-red-600 mb-2">Hatalar:</p>
                                            <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                                                {result.errors.map((error, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                        {error}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Instructions */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Şablonlar</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => downloadTemplate('accounts')}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Cari Hesap Şablonu
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => downloadTemplate('contacts')}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                İlgili Kişi Şablonu
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Import Sırası</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                                <li>Önce <strong>Cari Hesapları</strong> import edin</li>
                                <li>Sonra <strong>İlgili Kişileri</strong> import edin</li>
                                <li>İlgili kişiler <code>accountid</code> ile eşleştirilir</li>
                            </ol>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">vTiger Export</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>vTiger CRM'den export almak için:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>İlgili modüle gidin (Organizations / Contacts)</li>
                                <li>Export butonuna tıklayın</li>
                                <li>"Export all data" seçin</li>
                                <li>CSV dosyasını indirin</li>
                            </ol>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

interface DropZoneProps {
    dragActive: boolean;
    isLoading: boolean;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    title: string;
    description: string;
}

const DropZone = ({ dragActive, isLoading, onDrop, onDragOver, onDragLeave, onFileSelect, title, description }: DropZoneProps) => (
    <div
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
            ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => document.getElementById('csv-file-input')?.click()}
    >
        <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onFileSelect}
        />
        {isLoading ? (
            <>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
                <p className="mt-4 font-medium">Import ediliyor...</p>
            </>
        ) : (
            <>
                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <p className="text-xs text-muted-foreground mt-2">Sürükleyip bırakın veya tıklayın</p>
            </>
        )}
    </div>
);

export default CsvImport;
