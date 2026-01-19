import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';

interface Contact {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    mobile?: string;
    role?: string;
    department?: string;
    account_id: number;
}

interface Account {
    id: number;
    title: string;
}

const Contacts = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [newContact, setNewContact] = useState({
        first_name: '',
        last_name: '',
        account_id: '',
        email: '',
        phone: '',
        mobile: '',
        role: '',
        department: ''
    });

    const { data: contacts, isLoading } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const res = await api.get('/contacts/');
            return res.data;
        }
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await api.get('/accounts/');
            return res.data;
        }
    });

    const createMutation = useMutation({
        mutationFn: async (contact: any) => {
            return api.post('/contacts/', {
                ...contact,
                account_id: parseInt(contact.account_id)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setIsOpen(false);
            setNewContact({
                first_name: '',
                last_name: '',
                account_id: '',
                email: '',
                phone: '',
                mobile: '',
                role: '',
                department: ''
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newContact);
    };

    if (isLoading) return <div>Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Kişiler</h2>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Yeni Kişi</Button>
                    </DialogTrigger>
                    <DialogContent aria-describedby="new-contact-description">
                        <DialogHeader>
                            <DialogTitle>Yeni Kişi Ekle</DialogTitle>
                            <DialogDescription id="new-contact-description">Firma çalışanı veya iletişim kişisi ekleyin.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="first_name">Ad</Label>
                                    <Input
                                        id="first_name"
                                        required
                                        value={newContact.first_name}
                                        onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="last_name">Soyad</Label>
                                    <Input
                                        id="last_name"
                                        required
                                        value={newContact.last_name}
                                        onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="account">Bağlı Olduğu Firma</Label>
                                <select
                                    id="account"
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newContact.account_id}
                                    onChange={(e) => setNewContact({ ...newContact, account_id: e.target.value })}
                                >
                                    <option value="">Seçiniz</option>
                                    {accounts?.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="email">E-posta</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newContact.email}
                                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="mobile">Mobil</Label>
                                    <Input
                                        id="mobile"
                                        value={newContact.mobile}
                                        onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor="role">Unvan / Pozisyon</Label>
                                <Input
                                    id="role"
                                    value={newContact.role}
                                    placeholder="Örn: Satın Alma Müdürü"
                                    onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                                />
                            </div>

                            <Button type="submit" disabled={createMutation.isPending} className="w-full">
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
                                <TableHead>Ad Soyad</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead>Unvan</TableHead>
                                <TableHead>İletişim</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contacts?.map((contact) => (
                                <TableRow
                                    key={contact.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => navigate(`/contacts/${contact.id}`)}
                                >
                                    <TableCell className="font-medium">{contact.first_name} {contact.last_name}</TableCell>
                                    <TableCell>
                                        {accounts?.find(a => a.id === contact.account_id)?.title || '-'}
                                    </TableCell>
                                    <TableCell>{contact.role || '-'}</TableCell>
                                    <TableCell>
                                        {contact.email && <div>{contact.email}</div>}
                                        {contact.mobile && <div className="text-muted-foreground text-xs">{contact.mobile}</div>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Detay</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {contacts?.length === 0 && (
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

export default Contacts;
