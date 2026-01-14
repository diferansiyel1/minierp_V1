import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List as ListIcon, FileText } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Deal, Account } from '@/types';
import { KanbanBoard } from '@/components/deals/KanbanBoard';
import { DealList } from '@/components/deals/DealList';
import confetti from 'canvas-confetti';
import { DragEndEvent } from '@dnd-kit/core';

const columns = [
    { id: 'Lead', label: 'Potansiyel', color: 'bg-slate-500/10 border-slate-500/20' },
    { id: 'Opportunity', label: 'Fırsat', color: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'Quote Sent', label: 'Teklif Gönderildi', color: 'bg-yellow-500/10 border-yellow-500/20' },
    { id: 'Negotiation', label: 'Müzakere', color: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'Order Received', label: 'Sipariş Alındı', color: 'bg-green-500/10 border-green-500/20' },
];

const Deals = () => {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
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
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            if (variables.status === 'Order Received') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        const dealId = parseInt(active.id as string);
        const deal = deals?.find(d => d.id === dealId);

        // If dropping onto a column container (droppableId is status)
        // Check if over.id corresponds to a status
        const newStatus = over.id as string;

        if (deal && deal.status !== newStatus && columns.some(c => c.id === newStatus)) {
            updateStatusMutation.mutate({ dealId, status: newStatus });
        }
    };

    const openDealDetail = (deal: Deal) => {
        setSelectedDeal(deal);
        setIsDetailOpen(true);
    };

    if (isLoading) return <div>Yükleniyor...</div>;

    const totalValue = deals?.reduce((sum, d) => sum + d.estimated_value, 0) || 0;

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Satış Panosu</h2>
                    <p className="text-muted-foreground">
                        Toplam: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalValue)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="border rounded-md p-1 flex bg-muted/20">
                        <Button
                            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewMode('kanban')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewMode('list')}
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> Yeni Fırsat</Button>
                        </DialogTrigger>
                        <DialogContent aria-describedby="new-deal-description">
                            <DialogHeader>
                                <DialogTitle>Yeni Fırsat Ekle</DialogTitle>
                                <DialogDescription id="new-deal-description">Yeni satış fırsatı oluşturun.</DialogDescription>
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
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                {viewMode === 'kanban' ? (
                    <KanbanBoard
                        deals={deals || []}
                        columns={columns}
                        onDragEnd={handleDragEnd}
                        onDealClick={openDealDetail}
                    />
                ) : (
                    <DealList
                        deals={deals || []}
                        onDealClick={openDealDetail}
                    />
                )}
            </div>

            {/* Deal Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-md" aria-describedby="deal-detail-description">
                    <DialogHeader>
                        <DialogTitle>{selectedDeal?.title}</DialogTitle>
                        <DialogDescription id="deal-detail-description" className="sr-only">Fırsat detayları</DialogDescription>
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
