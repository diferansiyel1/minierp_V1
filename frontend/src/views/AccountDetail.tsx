import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building, FileText, Users, Plus, Trash2 } from 'lucide-react';
import { AccountTimeline, TimelineEvent } from '@/components/accounts/AccountTimeline';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AccountLedger from '@/views/AccountLedger'; // Reuse existing ledger view content if possible or re-implement
// Note: reusing AccountLedger directly might encompass its own layout/headers which we might want to suppress or wrap.
// For now, let's just integrate it as a tab content or keep navigation separate if complex. 
// Ideally we refactor Ledger to be a component but for speed, I'll simulate a simple integration or just data fetch.

const AccountDetail = () => {
    const { accountId } = useParams();
    const navigate = useNavigate();

    const { data: account, isLoading } = useQuery({
        queryKey: ['account', accountId],
        queryFn: async () => (await api.get(`/accounts/${accountId}`)).data
    });

    const { data: timelineEvents, isLoading: isTimelineLoading } = useQuery<TimelineEvent[]>({
        queryKey: ['account-timeline', accountId],
        queryFn: async () => {
            const res = await api.get(`/accounts/${accountId}/timeline`);
            return res.data;
        }
    });

    // Fetch contacts for this account
    const { data: contacts, isLoading: isContactsLoading } = useQuery({
        queryKey: ['contacts', accountId],
        queryFn: async () => {
            const res = await api.get(`/contacts?account_id=${accountId}`);
            return res.data;
        }
    });

    const queryClient = useQueryClient();
    const [isAddContactOpen, setIsAddContactOpen] = React.useState(false);
    const [newContact, setNewContact] = React.useState({ first_name: '', last_name: '', email: '', phone: '', role: '' });

    const addContactMutation = useMutation({
        mutationFn: async (contact: any) => {
            return api.post('/contacts/', { ...contact, account_id: parseInt(accountId || '0') });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts', accountId] });
            setIsAddContactOpen(false);
            setNewContact({ first_name: '', last_name: '', email: '', phone: '', role: '' });
        }
    });

    const deleteContactMutation = useMutation({
        mutationFn: async (contactId: number) => {
            return api.delete(`/contacts/${contactId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts', accountId] });
        }
    });

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">{account?.title}</h2>
                    <p className="text-muted-foreground">Müşteri Kartı</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Sidebar: Info */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">İletişim Bilgileri</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 text-sm">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span>{account?.tax_id ? `VKN: ${account.tax_id}` : 'Vergi No Girilmemiş'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{account?.address || 'Adres Girilmemiş'}</span>
                        </div>
                        {account?.billing_address && (
                            <div className="flex items-center gap-3 text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs"><strong>Fatura Adresi:</strong> {account.billing_address}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{account?.phone || 'Telefon Yok'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${account?.email}`} className="text-primary hover:underline">
                                {account?.email || 'E-posta Yok'}
                            </a>
                        </div>

                        <div className="pt-4 flex gap-2">
                            <Button variant="outline" className="w-full">
                                <Edit className="mr-2 h-4 w-4" /> Düzenle
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Content: Tabs */}
                <div className="md:col-span-2">
                    <Tabs defaultValue="timeline" className="w-full">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="timeline">Zaman Çizelgesi</TabsTrigger>
                            <TabsTrigger value="contacts">İlgili Kişiler</TabsTrigger>
                            <TabsTrigger value="ledger">Hesap Özeti</TabsTrigger>
                            <TabsTrigger value="deals">Fırsatlar</TabsTrigger>
                        </TabsList>

                        <TabsContent value="timeline" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle>Aktiviteler</CardTitle>
                                        <Button size="sm" variant="secondary">
                                            + Not Ekle
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isTimelineLoading ? (
                                        <div>Yükleniyor...</div>
                                    ) : (
                                        <AccountTimeline events={timelineEvents || []} />
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="contacts" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5" /> İlgili Kişiler
                                        </CardTitle>
                                        <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                                            <DialogTrigger asChild>
                                                <Button size="sm" variant="secondary">
                                                    <Plus className="mr-1 h-4 w-4" /> Kişi Ekle
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Yeni İlgili Kişi</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <Label>Ad</Label>
                                                            <Input
                                                                value={newContact.first_name}
                                                                onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Soyad</Label>
                                                            <Input
                                                                value={newContact.last_name}
                                                                onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label>Görev/Pozisyon</Label>
                                                        <Input
                                                            value={newContact.role}
                                                            onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                                                            placeholder="Örn: Satın Alma Müdürü"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <Label>E-posta</Label>
                                                            <Input
                                                                type="email"
                                                                value={newContact.email}
                                                                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Telefon</Label>
                                                            <Input
                                                                value={newContact.phone}
                                                                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={() => addContactMutation.mutate(newContact)}
                                                        disabled={addContactMutation.isPending || !newContact.first_name || !newContact.last_name}
                                                    >
                                                        {addContactMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isContactsLoading ? (
                                        <div className="flex justify-center py-4"><Spinner /></div>
                                    ) : contacts?.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-4">Henüz ilgili kişi eklenmedi.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {contacts?.map((c: any) => (
                                                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                    <div>
                                                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                                                        {c.role && <div className="text-sm text-muted-foreground">{c.role}</div>}
                                                        <div className="text-sm text-muted-foreground">
                                                            {c.email && <span className="mr-3">{c.email}</span>}
                                                            {c.phone && <span>{c.phone}</span>}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteContactMutation.mutate(c.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="ledger" className="mt-4">
                            {/* We can render the AccountLedger component here, but we might need to adjust it to not show its own header */}
                            <div className="border rounded-md p-4 bg-background">
                                <AccountLedger />
                            </div>
                        </TabsContent>

                        <TabsContent value="deals" className="mt-4">
                            <div className="p-4 text-center text-muted-foreground">
                                Bu müşteriye ait fırsatlar burada listelenecek.
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default AccountDetail;
