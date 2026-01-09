import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight, FileText } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Deal {
    id: number;
    title: string;
    status: string;
    estimated_value: number;
    customer_id: number;
    source?: string;
}

interface Account {
    id: number;
    title: string;
    account_type: string;
}

const columns = [
    { id: 'Lead', label: 'Potansiyel', color: 'bg-slate-500/10 border-slate-500/20' },
    { id: 'Opportunity', label: 'Fırsat', color: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'Quote Sent', label: 'Teklif Gönderildi', color: 'bg-yellow-500/10 border-yellow-500/20' },
    { id: 'Negotiation', label: 'Müzakere', color: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'Order Received', label: 'Sipariş Alındı', color: 'bg-green-500/10 border-green-500/20' },
];

const Deals = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const [newDeal, setNewDeal] = useState({
        title: '',
        customer_id: '',
        estimated_value: 0,
        source: '',
        status: 'Lead'
    });

    const { data: deals, isLoading } = useQuery<Deal[]>({
        queryKey: ['deals'],
        queryFn: async () => {
            const res = await api.get('/sales/deals');
            return res.data;
        }
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts', 'customers'],
        queryFn: async () => {
            const res = await api.get('/accounts/customers');
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: async (deal: any) => {
            return api.post('/sales/deals', deal);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            setIsOpen(false);
            setNewDeal({ title: '', customer_id: '', estimated_value: 0, source: '', status: 'Lead' });
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ dealId, status }: { dealId: number; status: string }) => {
            return api.patch(`/sales/deals/${dealId}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deals'] });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeal.customer_id) {
            alert('Lütfen bir müşteri seçin');
            return;
        }
        createMutation.mutate({
            ...newDeal,
            customer_id: parseInt(newDeal.customer_id)
        });
    };

    const handleMoveToNextStage = (deal: Deal) => {
        const currentIndex = columns.findIndex(c => c.id === deal.status);
        if (currentIndex < columns.length - 1) {
            const nextStatus = columns[currentIndex + 1].id;
            updateStatusMutation.mutate({ dealId: deal.id, status: nextStatus });
        }
    };

    const openDealDetail = (deal: Deal) => {
        setSelectedDeal(deal);
        setIsDetailOpen(true);
    };

    if (isLoading) return <div>Yükleniyor...</div>;

    const getColumnDeals = (status: string) => {
        return deals?.filter(deal => deal.status === status) || [];
    };

    const getColumnValue = (status: string) => {
        return getColumnDeals(status).reduce((sum, d) => sum + d.estimated_value, 0);
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Satış Panosu</h2>
                    <p className="text-muted-foreground">
                        Toplam: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
                            deals?.reduce((sum, d) => sum + d.estimated_value, 0) || 0
                        )}
                    </p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Yeni Fırsat</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Fırsat Ekle</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="customer">Müşteri *</Label>
                                <select
                                    id="customer"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newDeal.customer_id}
                                    onChange={(e) => setNewDeal({ ...newDeal, customer_id: e.target.value })}
                                    required
                                >
                                    <option value="">Müşteri seçin...</option>
                                    {accounts?.map((acc) => (
                                        <option key={acc.id} value={acc.id}>{acc.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="title">Fırsat Başlığı *</Label>
                                <Input
                                    id="title"
                                    required
                                    placeholder="Örn: Web Sitesi Projesi"
                                    value={newDeal.title}
                                    onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="value">Tahmini Değer</Label>
                                    <Input
                                        id="value"
                                        type="number"
                                        value={newDeal.estimated_value}
                                        onChange={(e) => setNewDeal({ ...newDeal, estimated_value: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="source">Kaynak</Label>
                                    <Input
                                        id="source"
                                        placeholder="Örn: Referans, Web"
                                        value={newDeal.source}
                                        onChange={(e) => setNewDeal({ ...newDeal, source: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex-1 overflow-x-auto">
                <div className="flex h-full gap-4 min-w-[1200px] pb-4">
                    {columns.map(col => (
                        <div key={col.id} className={cn("flex-1 rounded-lg p-4 border", col.color)}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider">
                                    {col.label}
                                    <Badge variant="secondary" className="ml-2">
                                        {getColumnDeals(col.id).length}
                                    </Badge>
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', notation: 'compact' }).format(getColumnValue(col.id))}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {getColumnDeals(col.id).map(deal => (
                                    <Card
                                        key={deal.id}
                                        className="cursor-pointer hover:shadow-md transition-shadow bg-card"
                                        onClick={() => openDealDetail(deal)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="font-medium text-sm mb-2">{deal.title}</div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">
                                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(deal.estimated_value)}
                                                </span>
                                                {col.id !== 'Order Received' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMoveToNextStage(deal);
                                                        }}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Deal Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedDeal?.title}</DialogTitle>
                    </DialogHeader>
                    {selectedDeal && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Durum:</span>
                                    <Badge className="ml-2">{selectedDeal.status}</Badge>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Değer:</span>
                                    <span className="ml-2 font-bold">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedDeal.estimated_value)}
                                    </span>
                                </div>
                            </div>
                            <DialogFooter className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsDetailOpen(false);
                                        window.location.href = `/quotes/new?deal_id=${selectedDeal.id}`;
                                    }}
                                >
                                    <FileText className="mr-2 h-4 w-4" /> Teklif Oluştur
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Deals;
