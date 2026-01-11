import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Eye, FileCheck, RotateCcw, ShoppingCart, Pencil, FileDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const statusColors: Record<string, string> = {
    'Draft': 'bg-slate-500',
    'Sent': 'bg-blue-500',
    'Accepted': 'bg-green-500',
    'Rejected': 'bg-red-500',
    'Expired': 'bg-orange-500'
};

const statusLabels: Record<string, string> = {
    'Draft': 'Taslak',
    'Sent': 'Gönderildi',
    'Accepted': 'Kabul Edildi',
    'Rejected': 'Reddedildi',
    'Expired': 'Süresi Doldu'
};

const QuoteList = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<string | null>(null);
    const [selectedQuote, setSelectedQuote] = useState<any>(null);
    const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
    const [searchParams] = useSearchParams();
    const dealId = searchParams.get('deal_id');

    const { data: quotes, isLoading } = useQuery({
        queryKey: ['quotes', filter],
        queryFn: async () => {
            const url = filter ? `/sales/quotes?status=${filter}` : '/sales/quotes';
            const res = await api.get(url);
            return res.data;
        }
    });

    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await api.get('/accounts')).data
    });

    const { data: products } = useQuery({
        queryKey: ['products'],
        queryFn: async () => (await api.get('/products')).data
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ quoteId, status }: { quoteId: number; status: string }) => {
            return api.patch(`/sales/quotes/${quoteId}/status?status=${status}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }
    });

    const reviseMutation = useMutation({
        mutationFn: async (quoteId: number) => {
            return api.post(`/sales/quotes/${quoteId}/revise`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
        }
    });

    const convertToOrderMutation = useMutation({
        mutationFn: async (quoteId: number) => {
            return api.post(`/sales/quotes/${quoteId}/convert-to-order`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            alert('Sipariş oluşturuldu!');
        }
    });

    if (isLoading) return <div>Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Teklifler</h2>
                <div className="flex gap-2">
                    <Button
                        variant={filter === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(null)}
                    >
                        Tümü
                    </Button>
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <Button
                            key={key}
                            variant={filter === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilter(key)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
                <Button onClick={() => navigate('/quotes/new')}>
                    <Plus className="mr-2 h-4 w-4" /> Yeni Teklif
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Teklif No</TableHead>
                                <TableHead>Müşteri</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead>Versiyon</TableHead>
                                <TableHead className="text-right">Toplam</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotes?.map((quote: any) => (
                                <TableRow key={quote.id}>
                                    <TableCell className="font-mono">{quote.quote_no}</TableCell>
                                    <TableCell>{quote.account?.title || '-'}</TableCell>
                                    <TableCell>
                                        <Badge className={statusColors[quote.status]}>
                                            {statusLabels[quote.status] || quote.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">V{quote.version}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: quote.currency || 'TRY' }).format(quote.total_amount)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(quote.created_at).toLocaleDateString('tr-TR')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setSelectedQuote(quote)}
                                                title="Görüntüle"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => navigate(`/quotes/new?quote_id=${quote.id}`)}
                                                title="Düzenle"
                                            >
                                                <Pencil className="h-4 w-4 text-yellow-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    window.open(`http://localhost:8000/sales/quotes/${quote.id}/pdf`, '_blank');
                                                }}
                                                title="PDF İndir"
                                            >
                                                <FileDown className="h-4 w-4 text-red-600" />
                                            </Button>
                                            {quote.status === 'Draft' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => updateStatusMutation.mutate({ quoteId: quote.id, status: 'Sent' })}
                                                    title="Gönderildi olarak işaretle"
                                                >
                                                    <FileCheck className="h-4 w-4 text-blue-500" />
                                                </Button>
                                            )}
                                            {quote.status === 'Sent' && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => convertToOrderMutation.mutate(quote.id)}
                                                        title="Siparişe Dönüştür"
                                                    >
                                                        <ShoppingCart className="h-4 w-4 text-green-500" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => reviseMutation.mutate(quote.id)}
                                                        title="Revizyon Oluştur"
                                                    >
                                                        <RotateCcw className="h-4 w-4 text-orange-500" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {quotes?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Henüz teklif bulunmuyor.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Quote Detail Dialog */}
            <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Teklif: {selectedQuote?.quote_no}
                            <Badge className={statusColors[selectedQuote?.status]}>
                                {statusLabels[selectedQuote?.status]}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedQuote && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Müşteri:</span>
                                    <div className="font-medium">{selectedQuote.account?.title}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Versiyon:</span>
                                    <div className="font-medium">V{selectedQuote.version}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Geçerlilik:</span>
                                    <div className="font-medium">
                                        {selectedQuote.valid_until
                                            ? new Date(selectedQuote.valid_until).toLocaleDateString('tr-TR')
                                            : '-'
                                        }
                                    </div>
                                </div>
                            </div>

                            {selectedQuote.notes && (
                                <div className="bg-muted p-3 rounded text-sm">
                                    <span className="text-muted-foreground">Notlar:</span>
                                    <p>{selectedQuote.notes}</p>
                                </div>
                            )}

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">Miktar</TableHead>
                                        <TableHead className="text-right">Birim Fiyat</TableHead>
                                        <TableHead className="text-right">İsk. %</TableHead>
                                        <TableHead className="text-right">KDV</TableHead>
                                        <TableHead className="text-right">Toplam</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedQuote.items?.map((item: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedQuote.currency || 'TRY' }).format(item.unit_price)}
                                            </TableCell>
                                            <TableCell className="text-right">{item.discount_percent}%</TableCell>
                                            <TableCell className="text-right">%{item.vat_rate}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedQuote.currency || 'TRY' }).format(item.total_with_vat)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <div className="flex justify-end">
                                <div className="w-64 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Ara Toplam:</span>
                                        <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedQuote.currency || 'TRY' }).format(selectedQuote.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>İskonto:</span>
                                        <span>-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedQuote.currency || 'TRY' }).format(selectedQuote.discount_amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>KDV:</span>
                                        <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedQuote.currency || 'TRY' }).format(selectedQuote.vat_amount)}</span>
                                    </div>
                                    <hr />
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>Genel Toplam:</span>
                                        <span>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedQuote.currency || 'TRY' }).format(selectedQuote.total_amount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default QuoteList;
