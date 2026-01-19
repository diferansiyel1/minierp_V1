import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Users as UserIcon } from 'lucide-react';
import { api } from '@/context/AuthContext';

// Keep interface for local usage
interface IUser {
    id: number;
    email: string;
    full_name: string;
    role: 'superadmin' | 'admin' | 'user';
    is_active: boolean;
}

export default function Users() {
    const [users, setUsers] = useState<IUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [newUserData, setNewUserData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'user'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get<IUser[]>('/users/');
            setUsers(response.data);
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Kullanıcılar yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await api.post('/users/', {
                full_name: newUserData.full_name,
                email: newUserData.email,
                password: newUserData.password,
                role: newUserData.role
            });

            toast.success('Kullanıcı başarıyla oluşturuldu');
            setIsDialogOpen(false);
            setNewUserData({ full_name: '', email: '', password: '', role: 'user' });
            loadUsers();
        } catch (error: any) {
            console.error('Error creating user:', error);
            const msg = error.response?.data?.detail || 'Kullanıcı oluşturulurken bir hata oluştu';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (user: IUser) => {
        if (!confirm(`${user.email} kullanıcısını silmek istediğinize emin misiniz?`)) return;

        try {
            await api.delete(`/users/${user.id}`);
            toast.success('Kullanıcı silindi (Pasife alındı)');
            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Silme işlemi başarısız');
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <UserIcon className="h-8 w-8 text-violet-600" />
                        Kullanıcı Yönetimi
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        Ekibinizdeki kullanıcıları ve yetkilerini yönetin.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-violet-600 hover:bg-violet-700">
                            <UserPlus className="mr-2 h-4 w-4" /> Yeni Kullanıcı
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
                            <DialogDescription>
                                Sisteme erişim sağlaması için yeni bir kullanıcı oluşturun.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullname">Ad Soyad</Label>
                                <Input
                                    id="fullname"
                                    value={newUserData.full_name}
                                    onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-posta Adresi</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newUserData.email}
                                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Şifre</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={newUserData.password}
                                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Rol</Label>
                                <Select
                                    value={newUserData.role}
                                    onValueChange={(val) => setNewUserData({ ...newUserData, role: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Rol seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">Kullanıcı (Standart)</SelectItem>
                                        <SelectItem value="admin">Yönetici (Admin)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Oluşturuluyor...' : 'Oluştur'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Kullanıcı Listesi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ad Soyad</TableHead>
                                <TableHead>E-posta</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Yükleniyor...</TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Kullanıcı bulunamadı.</TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.full_name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'admin' || user.role === 'superadmin' ? 'default' : 'secondary'}>
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.is_active ? 'outline' : 'destructive'} className={user.is_active ? 'text-green-600 bg-green-50 border-green-200' : ''}>
                                                {user.is_active ? 'Aktif' : 'Pasif'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteUser(user)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
