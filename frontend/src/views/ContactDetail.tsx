import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Phone, Building, Briefcase, FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ContactDetail = () => {
    const { contactId } = useParams();
    const navigate = useNavigate();

    const { data: contact, isLoading } = useQuery({
        queryKey: ['contact', contactId],
        queryFn: async () => (await api.get(`/contacts/${contactId}`)).data
    });

    const { data: quotes, isLoading: isQuotesLoading } = useQuery({
        queryKey: ['contact-quotes', contactId],
        queryFn: async () => (await api.get(`/contacts/${contactId}/quotes`)).data,
        enabled: !!contactId
    });

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
    if (!contact) return <div>Kişi bulunamadı.</div>;

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'Draft': 'bg-gray-100 text-gray-800',
            'Sent': 'bg-blue-100 text-blue-800',
            'Approved': 'bg-green-100 text-green-800',
            'Rejected': 'bg-red-100 text-red-800',
            'Expired': 'bg-orange-100 text-orange-800',
            'In Negotiation': 'bg-purple-100 text-purple-800'
        };
        return <Badge variant="outline" className={cn(styles[status] || 'bg-gray-100')}>{status}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">
                        {contact.first_name} {contact.last_name}
                    </h2>
                    <p className="text-muted-foreground">{contact.role || 'Unvan Girilmemiş'}</p>
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
                            {/* We need to fetch account name or it might be in contact if expanded */}
                            <span>Bağlı Firma (ID: {contact.account_id})</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.department || 'Departman Yok'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                                {contact.email || 'E-posta Yok'}
                            </a>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{contact.mobile || contact.phone || 'Telefon Yok'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Content: Tabs */}
                <div className="md:col-span-2">
                    <Tabs defaultValue="quotes" className="w-full">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="quotes">Teklifler</TabsTrigger>
                            <TabsTrigger value="activities">Aktiviteler</TabsTrigger>
                        </TabsList>

                        <TabsContent value="quotes" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-5 w-5" /> İlgili Teklifler
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isQuotesLoading ? (
                                        <div className="flex justify-center py-4"><Spinner /></div>
                                    ) : quotes?.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-4">Bu kişiye ait teklif bulunamadı.</div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Teklif No</TableHead>
                                                    <TableHead>Tarih</TableHead>
                                                    <TableHead>Tutar</TableHead>
                                                    <TableHead>Durum</TableHead>
                                                    <TableHead></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {quotes?.map((quote: any) => (
                                                    <TableRow key={quote.id}>
                                                        <TableCell className="font-medium">{quote.quote_no}</TableCell>
                                                        <TableCell>
                                                            {new Date(quote.created_at).toLocaleDateString('tr-TR')}
                                                        </TableCell>
                                                        <TableCell>
                                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: quote.currency || 'TRY' }).format(quote.total_amount)}
                                                        </TableCell>
                                                        <TableCell>{getStatusBadge(quote.status)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" onClick={() => navigate(`/quotes/${quote.id}`)}>
                                                                Görüntüle
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="activities" className="mt-4">
                            <div className="p-4 text-center text-muted-foreground">
                                Aktivite geçmişi yakında eklenecek.
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default ContactDetail;
