import React, { useState } from 'react';
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
    Wallet,
    Building2,
    Plus,
    ArrowRightLeft,
    ArrowDownCircle,
} from 'lucide-react';

interface FinancialAccount {
    id: number;
    name: string;
    account_type: string;
    currency: string;
    balance: number;
    description?: string;
    is_active: boolean;
    created_at: string;
}

interface FinancialSummary {
    total_cash: number;
    total_bank: number;
    total_balance: number;
}

const accountTypeIcon: Record<string, React.ReactNode> = {
    Cash: <Wallet className="w-6 h-6 text-green-500" />,
    Bank: <Building2 className="w-6 h-6 text-blue-500" />,
};

export default function FinancialAccounts() {
    const queryClient = useQueryClient();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        account_type: 'Cash',
        currency: 'TRY',
        initial_balance: 0,
        description: '',
    });
    const [transferData, setTransferData] = useState({
        source_account_id: 0,
        destination_account_id: 0,
        amount: 0,
        description: '',
    });

    const { data: accounts = [], isLoading } = useQuery<FinancialAccount[]>({
        queryKey: ['financial-accounts'],
        queryFn: async () => {
            const response = await api.get('/financial-accounts/');
            return response.data;
        },
    });

    const { data: summary } = useQuery<FinancialSummary>({
        queryKey: ['financial-summary'],
        queryFn: async () => {
            const response = await api.get('/financial-accounts/summary');
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const response = await api.post('/financial-accounts/', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
            setCreateDialogOpen(false);
            resetForm();
        },
    });

    const transferMutation = useMutation({
        mutationFn: async (data: typeof transferData) => {
            const response = await api.post('/financial-accounts/transfer', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
            setTransferDialogOpen(false);
            setTransferData({
                source_account_id: 0,
                destination_account_id: 0,
                amount: 0,
                description: '',
            });
        },
    });

    const resetForm = () => {
        setFormData({
            name: '',
            account_type: 'Cash',
            currency: 'TRY',
            initial_balance: 0,
            description: '',
        });
    };

    const formatCurrency = (amount: number, currency: string = 'TRY') => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency,
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
                    <h1 className="text-2xl font-bold text-gray-900">Kasa & Banka</h1>
                    <p className="text-gray-500">Nakit ve banka hesaplarını yönetin</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Virman
                    </Button>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni Hesap
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Wallet className="w-8 h-8 text-green-600" />
                            <div>
                                <p className="text-sm text-green-700">Toplam Kasa</p>
                                <p className="text-2xl font-bold text-green-800">
                                    {formatCurrency(summary?.total_cash || 0)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <Building2 className="w-8 h-8 text-blue-600" />
                            <div>
                                <p className="text-sm text-blue-700">Toplam Banka</p>
                                <p className="text-2xl font-bold text-blue-800">
                                    {formatCurrency(summary?.total_bank || 0)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <ArrowRightLeft className="w-8 h-8 text-purple-600" />
                            <div>
                                <p className="text-sm text-purple-700">Genel Toplam</p>
                                <p className="text-2xl font-bold text-purple-800">
                                    {formatCurrency(summary?.total_balance || 0)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Accounts List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                    <Card key={account.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    {accountTypeIcon[account.account_type]}
                                    <div>
                                        <CardTitle className="text-lg">{account.name}</CardTitle>
                                        <p className="text-sm text-gray-500">
                                            {account.account_type === 'Cash' ? 'Kasa' : 'Banka'}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${account.is_active
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                        }`}
                                >
                                    {account.is_active ? 'Aktif' : 'Pasif'}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-4">
                                <p
                                    className={`text-3xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}
                                >
                                    {formatCurrency(account.balance, account.currency)}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">{account.currency}</p>
                            </div>
                            {account.description && (
                                <p className="text-sm text-gray-500 text-center">{account.description}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Create Account Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Yeni Hesap Oluştur</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Hesap Adı</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Örn: Merkez Kasa, Garanti Bankası"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Hesap Tipi</Label>
                                <Select
                                    value={formData.account_type}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, account_type: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Kasa</SelectItem>
                                        <SelectItem value="Bank">Banka</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Para Birimi</Label>
                                <Select
                                    value={formData.currency}
                                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TRY">TRY</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Açılış Bakiyesi</Label>
                            <Input
                                type="number"
                                value={formData.initial_balance}
                                onChange={(e) =>
                                    setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })
                                }
                            />
                        </div>
                        <div>
                            <Label>Açıklama</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Opsiyonel"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            İptal
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate(formData)}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5" />
                            Hesaplar Arası Virman
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Kaynak Hesap</Label>
                            <Select
                                value={transferData.source_account_id.toString()}
                                onValueChange={(value) =>
                                    setTransferData({ ...transferData, source_account_id: parseInt(value) })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Hesap seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                            {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-center">
                            <ArrowDownCircle className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                            <Label>Hedef Hesap</Label>
                            <Select
                                value={transferData.destination_account_id.toString()}
                                onValueChange={(value) =>
                                    setTransferData({ ...transferData, destination_account_id: parseInt(value) })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Hesap seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts
                                        .filter((acc) => acc.id !== transferData.source_account_id)
                                        .map((acc) => (
                                            <SelectItem key={acc.id} value={acc.id.toString()}>
                                                {acc.name} ({formatCurrency(acc.balance, acc.currency)})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tutar</Label>
                            <Input
                                type="number"
                                value={transferData.amount}
                                onChange={(e) =>
                                    setTransferData({ ...transferData, amount: parseFloat(e.target.value) || 0 })
                                }
                            />
                        </div>
                        <div>
                            <Label>Açıklama</Label>
                            <Input
                                value={transferData.description}
                                onChange={(e) =>
                                    setTransferData({ ...transferData, description: e.target.value })
                                }
                                placeholder="Opsiyonel"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                            İptal
                        </Button>
                        <Button
                            onClick={() => transferMutation.mutate(transferData)}
                            disabled={transferMutation.isPending}
                        >
                            {transferMutation.isPending ? 'İşleniyor...' : 'Transfer Et'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
