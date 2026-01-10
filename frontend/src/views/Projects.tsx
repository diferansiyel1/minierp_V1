import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FolderKanban,
    Plus,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    FileText,
} from 'lucide-react';

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
}

interface ProjectSummary {
    project: Project;
    total_income: number;
    total_expense: number;
    profit: number;
    invoice_count: number;
}

const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-800',
    Completed: 'bg-blue-100 text-blue-800',
    'On Hold': 'bg-yellow-100 text-yellow-800',
};

export default function Projects() {
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'Active',
        budget: 0,
    });

    const { data: projects = [], isLoading } = useQuery<Project[]>({
        queryKey: ['projects'],
        queryFn: async () => {
            const response = await api.get('/projects/');
            return response.data;
        },
    });

    const { data: projectSummary } = useQuery<ProjectSummary>({
        queryKey: ['project-summary', selectedProject?.id],
        queryFn: async () => {
            const response = await api.get(`/projects/${selectedProject?.id}/summary`);
            return response.data;
        },
        enabled: !!selectedProject && summaryDialogOpen,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const response = await api.post('/projects/', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setDialogOpen(false);
            resetForm();
        },
    });

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            description: '',
            start_date: '',
            end_date: '',
            status: 'Active',
            budget: 0,
        });
    };

    const handleSubmit = () => {
        createMutation.mutate(formData);
    };

    const openSummary = (project: Project) => {
        setSelectedProject(project);
        setSummaryDialogOpen(true);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
        }).format(amount);
    };

    if (isLoading) {
        return <div className="p-6">Yükleniyor...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Projeler</h1>
                    <p className="text-gray-500">Ar-Ge projelerini yönetin</p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Proje
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <FolderKanban className="w-8 h-8 text-blue-500" />
                            <div>
                                <p className="text-sm text-gray-500">Toplam Proje</p>
                                <p className="text-2xl font-bold">{projects.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-8 h-8 text-green-500" />
                            <div>
                                <p className="text-sm text-gray-500">Aktif</p>
                                <p className="text-2xl font-bold">
                                    {projects.filter((p) => p.status === 'Active').length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-yellow-500" />
                            <div>
                                <p className="text-sm text-gray-500">Beklemede</p>
                                <p className="text-2xl font-bold">
                                    {projects.filter((p) => p.status === 'On Hold').length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <DollarSign className="w-8 h-8 text-purple-500" />
                            <div>
                                <p className="text-sm text-gray-500">Toplam Bütçe</p>
                                <p className="text-xl font-bold">
                                    {formatCurrency(projects.reduce((sum, p) => sum + p.budget, 0))}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                    <Card
                        key={project.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => openSummary(project)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{project.name}</CardTitle>
                                    <p className="text-sm text-gray-500">{project.code}</p>
                                </div>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-800'
                                        }`}
                                >
                                    {project.status}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {project.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                    {project.description}
                                </p>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Bütçe:</span>
                                <span className="font-medium">{formatCurrency(project.budget)}</span>
                            </div>
                            {project.start_date && (
                                <div className="flex justify-between text-sm mt-1">
                                    <span className="text-gray-500">Başlangıç:</span>
                                    <span>{new Date(project.start_date).toLocaleDateString('tr-TR')}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Create Project Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Yeni Proje Oluştur</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Proje Adı</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Proje adı"
                                />
                            </div>
                            <div>
                                <Label>Proje Kodu</Label>
                                <Input
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="PRJ-001"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Açıklama</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Proje açıklaması"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Başlangıç Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Bitiş Tarihi</Label>
                                <Input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Durum</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Aktif</SelectItem>
                                        <SelectItem value="On Hold">Beklemede</SelectItem>
                                        <SelectItem value="Completed">Tamamlandı</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Bütçe (TL)</Label>
                                <Input
                                    type="number"
                                    value={formData.budget}
                                    onChange={(e) =>
                                        setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            İptal
                        </Button>
                        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Project Summary Dialog */}
            <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderKanban className="w-5 h-5" />
                            {selectedProject?.name} - Finansal Özet
                        </DialogTitle>
                    </DialogHeader>
                    {projectSummary && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-green-500" />
                                            <div>
                                                <p className="text-sm text-gray-500">Toplam Gelir</p>
                                                <p className="text-xl font-bold text-green-600">
                                                    {formatCurrency(projectSummary.total_income)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="w-5 h-5 text-red-500" />
                                            <div>
                                                <p className="text-sm text-gray-500">Toplam Gider</p>
                                                <p className="text-xl font-bold text-red-600">
                                                    {formatCurrency(projectSummary.total_expense)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <Card
                                className={`${projectSummary.profit >= 0 ? 'bg-green-50' : 'bg-red-50'
                                    }`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <DollarSign
                                                className={`w-6 h-6 ${projectSummary.profit >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}
                                            />
                                            <div>
                                                <p className="text-sm text-gray-600">Net Kâr/Zarar</p>
                                                <p
                                                    className={`text-2xl font-bold ${projectSummary.profit >= 0 ? 'text-green-600' : 'text-red-600'
                                                        }`}
                                                >
                                                    {formatCurrency(projectSummary.profit)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <FileText className="w-4 h-4" />
                                                <span className="text-sm">{projectSummary.invoice_count} Fatura</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="text-sm text-gray-500">
                                <p>
                                    <strong>Bütçe:</strong> {formatCurrency(selectedProject?.budget || 0)}
                                </p>
                                {selectedProject?.start_date && (
                                    <p>
                                        <strong>Başlangıç:</strong>{' '}
                                        {new Date(selectedProject.start_date).toLocaleDateString('tr-TR')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
