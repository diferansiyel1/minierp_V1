import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/context/AuthContext';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Plus, Building2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Tenant {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
}

const SuperAdminDashboard = () => {
    const queryClient = useQueryClient();
    const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false);
    const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);

    // Fetch Tenants
    const { data: tenants, isLoading } = useQuery({
        queryKey: ['tenants'],
        queryFn: async () => {
            const res = await api.get<Tenant[]>('/tenants/');
            return res.data;
        }
    });

    // Create Tenant Mutation
    const createTenantMutation = useMutation({
        mutationFn: async (data: { name: string; slug: string }) => {
            await api.post('/tenants/', { ...data, is_active: true });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsCreateTenantOpen(false);
        }
    });

    // Create Tenant Admin Mutation
    const createAdminMutation = useMutation({
        mutationFn: async (data: { email: string; full_name: string; password: string }) => {
            if (!selectedTenantId) return;
            await api.post(`/tenants/${selectedTenantId}/admin`, data);
        },
        onSuccess: () => {
            setIsCreateAdminOpen(false);
            setSelectedTenantId(null);
            alert("Admin başarıyla oluşturuldu.");
        },
        onError: (error: any) => {
            alert("Hata: " + (error.response?.data?.detail || "Admin oluşturulamadı"));
        }
    });

    const handleCreateTenant = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        createTenantMutation.mutate({
            name: formData.get('name') as string,
            slug: formData.get('slug') as string,
        });
    };

    const handleCreateAdmin = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        createAdminMutation.mutate({
            email: formData.get('email') as string,
            full_name: formData.get('full_name') as string,
            password: formData.get('password') as string,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Kiracı Yönetimi</h2>
                    <p className="text-muted-foreground">Sistemdeki tüm şirketleri yönetin.</p>
                </div>
                <Dialog open={isCreateTenantOpen} onOpenChange={setIsCreateTenantOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
                            <Plus className="h-4 w-4" />
                            Yeni Şirket Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Şirket Oluştur</DialogTitle>
                            <DialogDescription>
                                Yeni bir müşteri/kiracı (tenant) firma oluşturun.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateTenant} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Şirket Adı</label>
                                <Input name="name" placeholder="Örn: ABC Teknoloji A.Ş." required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">URL Slug (Kısa Ad)</label>
                                <Input name="slug" placeholder="orp: abc-noloji" required />
                                <p className="text-[10px] text-gray-400">Benzersiz olmalıdır.</p>
                            </div>
                            <Button className="w-full bg-violet-600" disabled={createTenantMutation.isPending}>
                                {createTenantMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Tenant List */}
            <Card>
                <CardHeader>
                    <CardTitle>Şirketler Listesi</CardTitle>
                    <CardDescription>
                        Toplam {tenants?.length || 0} kayıtlı şirket bulunmaktadır.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">ID</TableHead>
                                <TableHead>Şirket Adı</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead>Oluşturulma</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Yükleniyor...</TableCell>
                                </TableRow>
                            ) : tenants?.map((tenant: Tenant) => (
                                <TableRow key={tenant.id}>
                                    <TableCell>{tenant.id}</TableCell>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-gray-400" />
                                        {tenant.name}
                                    </TableCell>
                                    <TableCell>{tenant.slug}</TableCell>
                                    <TableCell>
                                        <Badge variant={tenant.is_active ? 'default' : 'destructive'} className={tenant.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                                            {tenant.is_active ? 'Aktif' : 'Pasif'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(tenant.created_at).toLocaleDateString('tr-TR')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => {
                                                setSelectedTenantId(tenant.id);
                                                setIsCreateAdminOpen(true);
                                            }}
                                        >
                                            <UserPlus className="h-4 w-4" />
                                            Admin Ekle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Admin Dialog */}
            <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Yönetici Kullanıcısı Ekle</DialogTitle>
                        <DialogDescription>
                            Seçili şirket için yönetici yetkisine sahip bir kullanıcı oluşturun.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateAdmin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ad Soyad</label>
                            <Input name="full_name" placeholder="Ad Soyad" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">E-posta</label>
                            <Input name="email" type="email" placeholder="admin@sirket.com" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Şifre</label>
                            <Input name="password" type="password" placeholder="******" required />
                        </div>
                        <Button className="w-full bg-violet-600" disabled={createAdminMutation.isPending}>
                            {createAdminMutation.isPending ? 'Ekleniyor...' : 'Admin Ekle'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SuperAdminDashboard;
