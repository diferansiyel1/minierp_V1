import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Users, Truck, FileSpreadsheet, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

interface Account {
    id: number;
    account_type: string;
    entity_type: string;
    title: string;
    tax_id?: string;
    tax_office?: string;
    phone?: string;
    email?: string;
    address?: string;
    billing_address?: string;
    receivable_balance: number;
    payable_balance: number;
    website?: string;
    industry?: string;
}

const emptyAccount = {
    title: '',
    account_type: 'Customer',
    entity_type: 'Corporate',
    tax_id: '',
    tax_office: '',
    phone: '',
    email: '',
    address: '',
    billing_address: '',
    website: '',
    industry: ''
};

const AccountList = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [filter, setFilter] = useState<string | null>(null);
    const [newAccount, setNewAccount] = useState(emptyAccount);
    const [editAccount, setEditAccount] = useState<Account | null>(null);

    const { data: accounts = [], isLoading } = useQuery<Account[]>({
        queryKey: ['accounts', filter],
        queryFn: async () => {
            const url = filter ? `/accounts/?account_type=${filter}` : '/accounts/';
            const res = await api.get(url);
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const createMutation = useMutation({
        mutationFn: async (account: any) => {
            return api.post('/accounts/', account);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setIsCreateOpen(false);
            setNewAccount(emptyAccount);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (account: any) => {
            return api.put(`/accounts/${account.id}`, account);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setIsEditOpen(false);
            setEditAccount(null);
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newAccount);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (editAccount) {
            updateMutation.mutate(editAccount);
        }
    };

    const openEditDialog = (account: Account) => {
        setEditAccount({ ...account });
        setIsEditOpen(true);
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Cari Hesaplar</h2>

                <div className="flex gap-2">
                    <Button
                        variant={filter === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(null)}
                    >
                        Tümü
                    </Button>
                    <Button
                        variant={filter === 'Customer' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter('Customer')}
                    >
                        <Users className="mr-1 h-4 w-4" /> Müşteriler
                    </Button>
                    <Button
                        variant={filter === 'Supplier' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter('Supplier')}
                    >
                        <Truck className="mr-1 h-4 w-4" /> Tedarikçiler
                    </Button>
                </div>

                {/* Create Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Yeni Cari</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg" aria-describedby="create-account-description">
                        <DialogHeader>
                            <DialogTitle>Yeni Cari Kart Ekle</DialogTitle>
                            <DialogDescription id="create-account-description">Yeni müşteri veya tedarikçi hesabı oluşturun.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="account_type">Hesap Tipi</Label>
                                    <select
                                        id="account_type"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newAccount.account_type}
                                        onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}
                                    >
                                        <option value="Customer">Müşteri</option>
                                        <option value="Supplier">Tedarikçi</option>
                                        <option value="Both">Hem Müşteri Hem Tedarikçi</option>
                                    </select>
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="entity_type">Kişi Tipi</Label>
                                    <select
                                        id="entity_type"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newAccount.entity_type}
                                        onChange={(e) => setNewAccount({ ...newAccount, entity_type: e.target.value })}
                                    >
                                        <option value="Corporate">Kurumsal</option>
                                        <option value="Individual">Bireysel</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="title">Unvan / Ad Soyad</Label>
                                <Input
                                    id="title"
                                    required
                                    value={newAccount.title}
                                    onChange={(e) => setNewAccount({ ...newAccount, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="tax_id">Vergi No / TCKN</Label>
                                    <Input
                                        id="tax_id"
                                        value={newAccount.tax_id}
                                        onChange={(e) => setNewAccount({ ...newAccount, tax_id: e.target.value })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="tax_office">Vergi Dairesi</Label>
                                    <Input
                                        id="tax_office"
                                        value={newAccount.tax_office}
                                        onChange={(e) => setNewAccount({ ...newAccount, tax_office: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="email">E-posta</Label>
                                    <Input
                                        id="email"
                                        value={newAccount.email}
                                        onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="phone">Telefon</Label>
                                    <Input
                                        id="phone"
                                        value={newAccount.phone}
                                        onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="website">Web Sitesi</Label>
                                    <Input
                                        id="website"
                                        value={(newAccount as any).website || ''}
                                        onChange={(e) => setNewAccount({ ...newAccount, website: e.target.value } as any)}
                                        placeholder="https://"
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="industry">Sektör</Label>
                                    <Input
                                        id="industry"
                                        value={(newAccount as any).industry || ''}
                                        onChange={(e) => setNewAccount({ ...newAccount, industry: e.target.value } as any)}
                                        placeholder="Örn: Bilişim"
                                    />
                                </div>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="address">Adres</Label>
                                <Input
                                    id="address"
                                    value={newAccount.address}
                                    onChange={(e) => setNewAccount({ ...newAccount, address: e.target.value })}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="billing_address">Fatura Adresi *</Label>
                                <Input
                                    id="billing_address"
                                    required
                                    value={newAccount.billing_address}
                                    onChange={(e) => setNewAccount({ ...newAccount, billing_address: e.target.value })}
                                    placeholder="Fatura kesilecek adres"
                                />
                            </div>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-lg" aria-describedby="edit-account-description">
                    <DialogHeader>
                        <DialogTitle>Cari Kartı Düzenle</DialogTitle>
                        <DialogDescription id="edit-account-description">Mevcut cari hesap bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    {editAccount && (
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Hesap Tipi</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={editAccount.account_type}
                                        onChange={(e) => setEditAccount({ ...editAccount, account_type: e.target.value })}
                                    >
                                        <option value="Customer">Müşteri</option>
                                        <option value="Supplier">Tedarikçi</option>
                                        <option value="Both">Hem Müşteri Hem Tedarikçi</option>
                                    </select>
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Kişi Tipi</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={editAccount.entity_type}
                                        onChange={(e) => setEditAccount({ ...editAccount, entity_type: e.target.value })}
                                    >
                                        <option value="Corporate">Kurumsal</option>
                                        <option value="Individual">Bireysel</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Unvan / Ad Soyad</Label>
                                <Input
                                    required
                                    value={editAccount.title}
                                    onChange={(e) => setEditAccount({ ...editAccount, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Vergi No / TCKN</Label>
                                    <Input
                                        value={editAccount.tax_id || ''}
                                        onChange={(e) => setEditAccount({ ...editAccount, tax_id: e.target.value })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Vergi Dairesi</Label>
                                    <Input
                                        value={editAccount.tax_office || ''}
                                        onChange={(e) => setEditAccount({ ...editAccount, tax_office: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>E-posta</Label>
                                    <Input
                                        value={editAccount.email || ''}
                                        onChange={(e) => setEditAccount({ ...editAccount, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Telefon</Label>
                                    <Input
                                        value={editAccount.phone || ''}
                                        onChange={(e) => setEditAccount({ ...editAccount, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Web Sitesi</Label>
                                    <Input
                                        value={(editAccount as any).website || ''}
                                        onChange={(e) => setEditAccount({ ...editAccount, website: e.target.value } as any)}
                                        placeholder="https://"
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label>Sektör</Label>
                                    <Input
                                        value={(editAccount as any).industry || ''}
                                        onChange={(e) => setEditAccount({ ...editAccount, industry: e.target.value } as any)}
                                        placeholder="Örn: Bilişim"
                                    />
                                </div>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Adres</Label>
                                <Input
                                    value={editAccount.address || ''}
                                    onChange={(e) => setEditAccount({ ...editAccount, address: e.target.value })}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label>Fatura Adresi</Label>
                                <Input
                                    value={editAccount.billing_address || ''}
                                    onChange={(e) => setEditAccount({ ...editAccount, billing_address: e.target.value })}
                                    placeholder="Fatura kesilecek adres"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={updateMutation.isPending}>
                                    {updateMutation.isPending ? 'Kaydediliyor...' : 'Güncelle'}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                                    İptal
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Unvan</TableHead>
                                <TableHead>Tip</TableHead>
                                <TableHead>Vergi No</TableHead>
                                <TableHead>İletişim</TableHead>
                                <TableHead className="text-right">Alacak</TableHead>
                                <TableHead className="text-right">Borç</TableHead>
                                <TableHead>İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map((account) => (
                                <TableRow key={account.id}>
                                    <TableCell className="font-medium">
                                        <button
                                            onClick={() => navigate(`/accounts/${account.id}`)}
                                            className="hover:underline text-primary font-semibold text-left"
                                        >
                                            {account.title}
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={account.account_type === 'Customer' ? 'default' : account.account_type === 'Supplier' ? 'secondary' : 'outline'}>
                                            {account.account_type === 'Customer' ? 'Müşteri' : account.account_type === 'Supplier' ? 'Tedarikçi' : 'Her İkisi'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{account.tax_id}</TableCell>
                                    <TableCell>
                                        {account.email}<br />
                                        <span className="text-muted-foreground text-xs">{account.phone}</span>
                                    </TableCell>
                                    <TableCell className={cn("text-right font-bold", account.receivable_balance > 0 ? "text-green-600" : "")}>
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account.receivable_balance)}
                                    </TableCell>
                                    <TableCell className={cn("text-right font-bold", account.payable_balance > 0 ? "text-red-600" : "")}>
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account.payable_balance)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditDialog(account)}
                                                title="Düzenle"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate(`/accounts/${account.id}/ledger`)}
                                            >
                                                <FileSpreadsheet className="h-4 w-4 mr-1" /> Ekstre
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {accounts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Kayıt bulunamadı.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default AccountList;
