
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    FolderKanban,
    Calendar,
    Building2,
    DollarSign,
    TrendingUp,
    TrendingDown,
    FileText,
    Upload,
    Download,
    Trash2,
    ArrowLeft,
    Calculator,
    AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Project {
    id: number;
    name: string;
    code: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status: string;
    budget: number;
    created_at: string;
    is_technopark_project?: boolean;
    exemption_code?: string;
}

interface ProjectSummary {
    project: Project;
    total_income: number;
    total_expense: number;
    profit: number;
    invoice_count: number;
}

interface ExemptionReport {
    id: number;
    project_id: number;
    year: number;
    month: number;
    file_name: string;
    notes?: string;
    created_at: string;
}

interface AccountingSummary {
    income: {
        exempt: number;
        taxable: number;
        vat: number;
        total: number;
    };
    expense: {
        total: number;
        personnel: number;
        breakdown: Record<string, number>;
    };
    summary: {
        net_result: number;
    };
    calculated_tax_advantages?: {
        corporate_tax: number;
        vat: number;
    };
}

const ProjectDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const projectId = id ? parseInt(id) : 0;

    // State for Exemption Reports
    const currentDate = new Date();
    const [year, setYear] = useState<number>(currentDate.getFullYear());
    const [month, setMonth] = useState<number>(currentDate.getMonth() + 1);
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    // State for Manual Exemption Inputs
    const [personnelIncomeTaxExemption, setPersonnelIncomeTaxExemption] = useState<number>(0);
    const [personnelSgkExemption, setPersonnelSgkExemption] = useState<number>(0);
    const [personnelStampTaxExemption, setPersonnelStampTaxExemption] = useState<number>(0);

    // Project Details Query
    const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
        queryKey: ['project', projectId],
        queryFn: async () => {
            const response = await api.get(`/projects/${projectId}`); // Assuming there is get by ID endpoint or filtering list
            // Fallback if no specific get endpoint:
            if (!response.data || Array.isArray(response.data)) {
                const allProjects = await api.get('/projects');
                return allProjects.data.find((p: Project) => p.id === projectId);
            }
            return response.data;
        },
        enabled: !!projectId,
    });

    const { data: projectSummary } = useQuery<ProjectSummary>({
        queryKey: ['project-summary', projectId],
        queryFn: async () => {
            const response = await api.get(`/projects/${projectId}/summary`);
            return response.data;
        },
        enabled: !!projectId,
    });

    // --- Exemption Reports Logic ---

    // Reports Query
    const { data: reports = [], isLoading: isLoadingReports } = useQuery<ExemptionReport[]>({
        queryKey: ['exemption-reports', projectId, year, month],
        queryFn: async () => {
            const params: any = { year, month, project_id: projectId };
            const response = await api.get('/exemption-reports', { params });
            return response.data;
        },
        enabled: !!projectId && !!project?.is_technopark_project,
    });

    // Accounting Summary Query
    const { data: accountingData, isLoading: isLoadingAccounting } = useQuery<AccountingSummary>({
        queryKey: ['monthly-accounting', projectId, year, month],
        queryFn: async () => {
            const response = await api.get('/exemption-reports/monthly-accounting', {
                params: { project_id: projectId, year, month }
            });
            return response.data;
        },
        enabled: !!projectId && !!project?.is_technopark_project,
    });

    // Upload Mutation
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('project_id', projectId.toString());
            formData.append('year', year.toString());
            formData.append('month', month.toString());
            formData.append('total_personnel_cost', '0');
            formData.append('total_rd_expense', accountingData?.expense.total.toString() || '0');
            formData.append('total_exempt_income', accountingData?.income.exempt.toString() || '0');
            formData.append('total_taxable_income', accountingData?.income.taxable.toString() || '0');

            // Manual Exemption Inputs
            formData.append('personnel_income_tax_exemption_amount', personnelIncomeTaxExemption.toString());
            formData.append('personnel_sgk_exemption_amount', personnelSgkExemption.toString());
            formData.append('personnel_stamp_tax_exemption_amount', personnelStampTaxExemption.toString());

            await api.post('/exemption-reports', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exemption-reports'] });
            toast.success('Rapor başarıyla yüklendi');
            setUploadFile(null);
            // Reset manual inputs
            setPersonnelIncomeTaxExemption(0);
            setPersonnelSgkExemption(0);
            setPersonnelStampTaxExemption(0);
        },
        onError: (error: any) => {
            toast.error('Rapor yüklenirken hata oluştu: ' + (error.response?.data?.detail || error.message));
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (reportId: number) => {
            await api.delete(`/exemption-reports/${reportId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exemption-reports'] });
            toast.success('Rapor silindi');
        },
    });

    const handleDownload = async (report: ExemptionReport) => {
        try {
            const response = await api.get(`/exemption-reports/${report.id}/download`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', report.file_name);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            toast.error('Dosya indirilemedi');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
        }).format(amount);
    };

    const statusColors: Record<string, string> = {
        Active: 'bg-green-100 text-green-800',
        Completed: 'bg-blue-100 text-blue-800',
        'On Hold': 'bg-yellow-100 text-yellow-800',
    };

    if (isLoadingProject) {
        return <div className="p-6">Yükleniyor...</div>;
    }

    if (!project) {
        return <div className="p-6">Proje bulunamadı.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <div className="flex items-center gap-3">
                        <FolderKanban className="w-8 h-8 text-violet-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>{project.code}</span>
                                <span>•</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
                                    {project.status}
                                </span>
                                {project.is_technopark_project && (
                                    <Badge variant="outline" className="text-blue-600 border-blue-600/30 bg-blue-50 text-xs">
                                        <Building2 className="w-3 h-3 mr-1" /> Teknokent Projesi
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
                    <TabsTrigger value="financials">Finansal Özet</TabsTrigger>
                    {project.is_technopark_project && (
                        <TabsTrigger value="exemption">Muafiyet Raporları</TabsTrigger>
                    )}
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Proje Detayları</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Açıklama</h3>
                                    <p className="mt-1 text-gray-900">{project.description || '-'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Başlangıç Tarihi</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>{project.start_date ? new Date(project.start_date).toLocaleDateString('tr-TR') : '-'}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Bitiş Tarihi</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>{project.end_date ? new Date(project.end_date).toLocaleDateString('tr-TR') : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Bütçe</h3>
                                    <div className="flex items-center gap-2 mt-1 text-lg font-semibold">
                                        <DollarSign className="w-5 h-5 text-gray-400" />
                                        <span>{formatCurrency(project.budget)}</span>
                                    </div>
                                </div>
                                {project.is_technopark_project && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500">Muafiyet Kodu</h3>
                                        <p className="mt-1">{project.exemption_code || '4691'}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Özet Bütçe Durumu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {projectSummary ? (
                                    <div className="space-y-6">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium">Bütçe Kullanımı</span>
                                                <span className="text-sm text-gray-500">
                                                    {formatCurrency(projectSummary.total_expense)} / {formatCurrency(project.budget)}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className="bg-blue-600 h-2.5 rounded-full"
                                                    style={{ width: `${Math.min((projectSummary.total_expense / (project.budget || 1)) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="border rounded-lg p-3">
                                                <p className="text-sm text-gray-500 mb-1">Kalan Bütçe</p>
                                                <p className="text-lg font-bold text-gray-900">
                                                    {formatCurrency(project.budget - projectSummary.total_expense)}
                                                </p>
                                            </div>
                                            <div className="border rounded-lg p-3">
                                                <p className="text-sm text-gray-500 mb-1">Faturalandırılan</p>
                                                <p className="text-lg font-bold text-green-600">
                                                    {formatCurrency(projectSummary.total_income)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-500">Veri yükleniyor...</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Financials Tab */}
                <TabsContent value="financials">
                    {projectSummary ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-green-100 rounded-full">
                                                <TrendingUp className="w-6 h-6 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Toplam Gelir</p>
                                                <p className="text-2xl font-bold text-green-700">
                                                    {formatCurrency(projectSummary.total_income)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-red-100 rounded-full">
                                                <TrendingDown className="w-6 h-6 text-red-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Toplam Gider</p>
                                                <p className="text-2xl font-bold text-red-700">
                                                    {formatCurrency(projectSummary.total_expense)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-full ${projectSummary.profit >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                                                <Calculator className={`w-6 h-6 ${projectSummary.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Net Kâr/Zarar</p>
                                                <p className={`text-2xl font-bold ${projectSummary.profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                                    {formatCurrency(projectSummary.profit)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Finansal Detaylar</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-gray-600">
                                        Bu kısımda gelir/gider detay tabloları veya zaman çizelgesi grafikleri eklenebilir.
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div>Yükleniyor...</div>
                    )}
                </TabsContent>

                {/* Exemption Reports Tab */}
                <TabsContent value="exemption">
                    <div className="space-y-6">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Yıl</Label>
                                        <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026].map((y) => (
                                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ay</Label>
                                        <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                    <SelectItem key={m} value={m.toString()}>
                                                        {new Date(0, m - 1).toLocaleString('tr-TR', { month: 'long' })}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Accounting Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-green-50/50 border-green-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" /> Gelirler
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-900">
                                        {formatCurrency(accountingData?.income.total || 0)}
                                    </div>
                                    <div className="text-xs text-green-700 mt-1 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Muaf:</span>
                                            <span>{formatCurrency(accountingData?.income.exempt || 0)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Vergiye Tabi:</span>
                                            <span>{formatCurrency(accountingData?.income.taxable || 0)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-red-50/50 border-red-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                                        <TrendingDown className="h-4 w-4" /> Giderler
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-red-900">
                                        {formatCurrency(accountingData?.expense.total || 0)}
                                    </div>
                                    <div className="text-xs text-red-700 mt-1 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Ar-Ge Harcamaları:</span>
                                            <span>{formatCurrency(accountingData?.expense.total || 0)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Personel:</span>
                                            <span>{formatCurrency(accountingData?.expense.personnel || 0)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-blue-50/50 border-blue-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                                        <Calculator className="h-4 w-4" /> Net Durum
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-blue-900">
                                        {formatCurrency(accountingData?.summary.net_result || 0)}
                                    </div>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Dönem Net Kâr/Zarar
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-violet-50/50 border-violet-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-violet-800 flex items-center gap-2">
                                        <Building2 className="h-4 w-4" /> Vergi Avantajı
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-violet-900">
                                        {formatCurrency(
                                            (accountingData?.calculated_tax_advantages?.corporate_tax || 0) +
                                            (accountingData?.calculated_tax_advantages?.vat || 0)
                                        )}
                                    </div>
                                    <div className="text-xs text-violet-700 mt-1 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Kurumlar Vergisi:</span>
                                            <span>{formatCurrency(accountingData?.calculated_tax_advantages?.corporate_tax || 0)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>KDV (%20):</span>
                                            <span>{formatCurrency(accountingData?.calculated_tax_advantages?.vat || 0)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Reports List & Upload */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <Card className="h-full">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <FileText className="h-5 w-5" /> Yüklenen Raporlar
                                        </CardTitle>
                                        <CardDescription>
                                            Seçili dönem için muafiyet raporları
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Dosya Adı</TableHead>
                                                    <TableHead>Yükleme Tarihi</TableHead>
                                                    <TableHead className="w-[100px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reports.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                                            Bu dönem için rapor bulunamadı
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reports.map((report) => (
                                                        <TableRow key={report.id}>
                                                            <TableCell className="font-medium flex items-center gap-2">
                                                                <FileText className="h-4 w-4 text-blue-500" />
                                                                {report.file_name}
                                                            </TableCell>
                                                            <TableCell>
                                                                {new Date(report.created_at).toLocaleDateString('tr-TR')}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-blue-500"
                                                                        onClick={() => handleDownload(report)}
                                                                    >
                                                                        <Download className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-red-500"
                                                                        onClick={() => {
                                                                            if (confirm('Bu raporu silmek istediğinize emin misiniz?')) {
                                                                                deleteMutation.mutate(report.id);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>

                            <div>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Upload className="h-5 w-5" /> Rapor Yükle
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center gap-2 hover:bg-muted/50 transition-colors">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">
                                                    Dosyayı sürükleyin veya seçin
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    PDF (Max 5MB)
                                                </p>
                                            </div>
                                            <Input
                                                type="file"
                                                className="hidden"
                                                id="file-upload"
                                                accept=".pdf"
                                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                            />
                                            <Button variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                                                Dosya Seç
                                            </Button>
                                        </div>

                                        {uploadFile && (
                                            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                                    <span className="text-sm truncate">{uploadFile.name}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => setUploadFile(null)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="space-y-3 pt-2">
                                            <Label className="text-sm font-semibold">Personel İstisnaları (Opsiyonel)</Label>

                                            <div className="grid grid-cols-1 gap-2">
                                                <div>
                                                    <Label className="text-xs text-gray-500">Gelir Vergisi İstisnası</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-sm"
                                                        value={personnelIncomeTaxExemption}
                                                        onChange={(e) => setPersonnelIncomeTaxExemption(parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-500">SGK İşveren His. Desteği</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-sm"
                                                        value={personnelSgkExemption}
                                                        onChange={(e) => setPersonnelSgkExemption(parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-gray-500">Damga Vergisi İstisnası</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-sm"
                                                        value={personnelStampTaxExemption}
                                                        onChange={(e) => setPersonnelStampTaxExemption(parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full"
                                            disabled={!uploadFile || uploadMutation.isPending}
                                            onClick={() => uploadFile && uploadMutation.mutate(uploadFile)}
                                        >
                                            {uploadMutation.isPending ? 'Yükleniyor...' : 'Raporu Kaydet'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ProjectDetail;
