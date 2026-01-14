import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Customer {
    id: number;
    type: string;
    title: string;
    tax_id?: string;
    phone?: string;
    email?: string;
    balance: number;
}

const CustomerList = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        title: '',
        type: 'Corporate',
        tax_id: '',
        phone: '',
        email: ''
    });

    const { data: customers, isLoading } = useQuery<Customer[]>({
        queryKey: ['customers'],
        queryFn: async () => {
            const res = await api.get('/customers');
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: async (customer: any) => {
            return api.post('/customers', customer);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setIsOpen(false);
            setNewCustomer({ title: '', type: 'Corporate', tax_id: '', phone: '', email: '' });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newCustomer);
    };

    if (isLoading) return <div>Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Cari Hesaplar</h2>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Yeni Cari</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Cari Kart Ekle</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="title">Unvan / Ad Soyad</Label>
                                <Input
                                    id="title"
                                    required
                                    value={newCustomer.title}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, title: e.target.value })}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="type">Tip</Label>
                                <select
                                    id="type"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newCustomer.type}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, type: e.target.value })}
                                >
                                    <option value="Corporate">Kurumsal</option>
                                    <option value="Individual">Bireysel</option>
                                </select>
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="tax_id">Vergi No / TCKN</Label>
                                <Input
                                    id="tax_id"
                                    value={newCustomer.tax_id}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, tax_id: e.target.value })}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="email">E-posta</Label>
                                <Input
                                    id="email"
                                    value={newCustomer.email}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                />
                            </div>
                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="phone">Telefon</Label>
                                <Input
                                    id="phone"
                                    value={newCustomer.phone}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                />
                            </div>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Unvan</TableHead>
                                <TableHead>Tip</TableHead>
                                <TableHead>Vergi No</TableHead>
                                <TableHead>İletişim</TableHead>
                                <TableHead className="text-right">Bakiye</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers?.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.title}</TableCell>
                                    <TableCell>{customer.type === 'Corporate' ? 'Kurumsal' : 'Bireysel'}</TableCell>
                                    <TableCell>{customer.tax_id}</TableCell>
                                    <TableCell>
                                        {customer.email}<br />
                                        <span className="text-muted-foreground text-xs">{customer.phone}</span>
                                    </TableCell>
                                    <TableCell className={cn("text-right font-bold", customer.balance > 0 ? "text-green-600" : customer.balance < 0 ? "text-red-600" : "")}>
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(customer.balance)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {customers?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Kayıt bulunamadı.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomerList;
