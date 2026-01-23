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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
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
            const res = await api.get(`/contacts/?account_id=${accountId}`);
            return res.data;
        }
    });

    const queryClient = useQueryClient();
    const [isAddContactOpen, setIsAddContactOpen] = React.useState(false);
    const [newContact, setNewContact] = React.useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: '',
        mobile: '',
        department: '',
        salutation: ''
    });

    const addContactMutation = useMutation({
        mutationFn: async (contact: any) => {
            return api.post('/contacts/', { ...contact, account_id: parseInt(accountId || '0') });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts', accountId] });
            setIsAddContactOpen(false);
            setNewContact({
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                role: '',
                mobile: '',
                department: '',
                salutation: ''
            });
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
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">{account?.title}</h2>
                    <p className="text-muted-foreground">Müşteri Kartı</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Sidebar: Info */}
                <Card className="lg:col-span-1 h-fit shadow-md border-0 bg-white/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" /> İletişim Bilgileri
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <Building className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                                <span className="font-medium text-xs text-muted-foreground">Vergi Numarası</span>
                                <span>{account?.tax_id || 'Girilmemiş'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <MapPin className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                                <span className="font-medium text-xs text-muted-foreground">Adres</span>
                                <span>{account?.address || 'Girilmemiş'}</span>
                            </div>
                        </div>
                        {account?.billing_address && (
                            <div className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50 transition-colors">
                                <FileText className="h-4 w-4 text-primary" />
                                <div className="flex flex-col">
                                    <span className="font-medium text-xs text-muted-foreground">Fatura Adresi</span>
                                    <span>{account.billing_address}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <Phone className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                                <span className="font-medium text-xs text-muted-foreground">Telefon</span>
                                <span>{account?.phone || 'Yok'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm p-2 rounded-md hover:bg-muted/50 transition-colors">
                            <Mail className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                                <span className="font-medium text-xs text-muted-foreground">E-posta</span>
                                <a href={`mailto:${account?.email}`} className="text-primary hover:underline">
                                    {account?.email || 'Yok'}
                                </a>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-2">
                            <Button variant="outline" className="w-full hover:bg-primary hover:text-white transition-colors">
                                <Edit className="mr-2 h-4 w-4" /> Düzenle
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Content: Tabs */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="timeline" className="w-full">
                        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto py-2 bg-transparent">
                            <TabsTrigger value="timeline" className="data-[state=active]:bg-primary/15 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 rounded-full px-4">Zaman Çizelgesi</TabsTrigger>
                            <TabsTrigger value="contacts" className="data-[state=active]:bg-primary/15 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 rounded-full px-4">İlgili Kişiler</TabsTrigger>
                            <TabsTrigger value="ledger" className="data-[state=active]:bg-primary/15 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 rounded-full px-4">Hesap Özeti</TabsTrigger>
                            <TabsTrigger value="deals" className="data-[state=active]:bg-primary/15 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 rounded-full px-4">Fırsatlar</TabsTrigger>
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
                            <Card className="shadow-md border-0 bg-white/50 backdrop-blur-sm">
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
                                            <DialogContent aria-describedby="add-contact-desc">
                                                <DialogHeader>
                                                    <DialogTitle>Yeni İlgili Kişi</DialogTitle>
                                                    <DialogDescription id="add-contact-desc">Cari hesaba yeni iletişim kişisi ekleyin.</DialogDescription>
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
                                                                placeholder="İş Telefonu"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label>Cep Telefonu</Label>
                                                            <Input
                                                                value={(newContact as any).mobile || ''}
                                                                onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value } as any)}
                                                                placeholder="Cep Telefonu"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <Label>Unvan (Salutation)</Label>
                                                            <select
                                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                                value={(newContact as any).salutation || ''}
                                                                onChange={(e) => setNewContact({ ...newContact, salutation: e.target.value } as any)}
                                                            >
                                                                <option value="">Seçiniz</option>
                                                                <option value="Mr.">Bay</option>
                                                                <option value="Mrs.">Bayan</option>
                                                                <option value="Dr.">Dr.</option>
                                                                <option value="Prof.">Prof.</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <Label>Departman</Label>
                                                            <Input
                                                                value={(newContact as any).department || ''}
                                                                onChange={(e) => setNewContact({ ...newContact, department: e.target.value } as any)}
                                                                placeholder="Departman"
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
