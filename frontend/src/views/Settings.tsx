import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingsService } from '@/services/settings';
import { toast } from 'sonner';


export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Company Settings State
    const [companySettings, setCompanySettings] = useState({
        company_name: '',
        tax_id: '',
        tax_office: '',
        address: '',
        phone: '',
        email: '',
        logo_url: '',
        website: ''
    });

    // Quote Configuration State
    const [quotePrefix, setQuotePrefix] = useState('PA');
    const [quoteYear, setQuoteYear] = useState('26');
    const [quoteSequence, setQuoteSequence] = useState('1');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);

            // Load Company Info (new endpoint)
            try {
                // Assuming settingsService has getCompanyInfo method now (we need to update service too)
                // If not, we fall back or implemented it in service update step
                const companyInfo = await settingsService.getCompanyInfo();
                if (companyInfo) {
                    setCompanySettings({
                        company_name: companyInfo.company_name || '',
                        tax_id: companyInfo.tax_id || '',
                        tax_office: companyInfo.tax_office || '',
                        address: companyInfo.address || '',
                        phone: companyInfo.phone || '',
                        email: companyInfo.email || '',
                        logo_url: companyInfo.logo_url || '',
                        website: companyInfo.website || ''
                    });

                    if (companyInfo.quote_prefix) setQuotePrefix(companyInfo.quote_prefix);
                    if (companyInfo.quote_year) setQuoteYear(companyInfo.quote_year);
                    if (companyInfo.quote_sequence) setQuoteSequence(String(companyInfo.quote_sequence));
                }
            } catch (err) {
                console.log("Company info fetch failed, possibly not implemented yet", err);
            }

        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Ayarlar yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCompanySettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            await settingsService.updateCompanyInfo({
                ...companySettings,
                quote_prefix: quotePrefix,
                quote_year: quoteYear,
                quote_sequence: parseInt(quoteSequence)
            });
            toast.success('Firma bilgileri başarıyla kaydedildi.');
        } catch (error) {
            console.error('Error saving company settings:', error);
            toast.error('Ayarlar kaydedilirken bir hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8">Yükleniyor...</div>;
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Sistem Ayarları</h2>
                <p className="text-muted-foreground mt-2">
                    Firma bilgileri ve uygulama konfigürasyonlarını buradan yönetebilirsiniz.
                </p>
            </div>

            <Tabs defaultValue="company" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="company">Firma Bilgileri</TabsTrigger>
                    <TabsTrigger value="quotes">Teklif Ayarları</TabsTrigger>
                </TabsList>

                <TabsContent value="company">
                    <Card>
                        <CardHeader>
                            <CardTitle>Firma Künyesi</CardTitle>
                            <CardDescription>
                                Bu hilanlar fatura ve teklif şablonlarında kullanılacaktır.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveCompanySettings} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Firma Unvanı</Label>
                                        <Input
                                            value={companySettings.company_name}
                                            onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                                            placeholder="Şirket Tam Unvanı"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Web Sitesi</Label>
                                        <Input
                                            value={companySettings.website}
                                            onChange={(e) => setCompanySettings({ ...companySettings, website: e.target.value })}
                                            placeholder="www.sirket.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Vergi Dairesi</Label>
                                        <Input
                                            value={companySettings.tax_office}
                                            onChange={(e) => setCompanySettings({ ...companySettings, tax_office: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Vergi Numarası</Label>
                                        <Input
                                            value={companySettings.tax_id}
                                            onChange={(e) => setCompanySettings({ ...companySettings, tax_id: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Adres</Label>
                                        <Input
                                            value={companySettings.address}
                                            onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                                            placeholder="Tam adres"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Telefon</Label>
                                        <Input
                                            value={companySettings.phone}
                                            onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                                            placeholder="+90..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>E-posta</Label>
                                        <Input
                                            value={companySettings.email}
                                            onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                                            placeholder="info@sirket.com"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Logo URL</Label>
                                        <Input
                                            value={companySettings.logo_url}
                                            onChange={(e) => setCompanySettings({ ...companySettings, logo_url: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <p className="text-[0.8rem] text-muted-foreground">Şirket logosunun herkese açık URL adresi.</p>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={saving}>
                                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="quotes">
                    <Card>
                        <CardHeader>
                            <CardTitle>Teklif Konfigürasyonu</CardTitle>
                            <CardDescription>
                                Teklif numaralarının nasıl oluşturulacağını belirleyin.
                                Örnek format: {quotePrefix}{quoteYear}{quoteSequence.padStart(3, '0')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveCompanySettings} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quotePrefix">Ön Ek</Label>
                                        <Input
                                            id="quotePrefix"
                                            value={quotePrefix}
                                            onChange={(e) => setQuotePrefix(e.target.value)}
                                            placeholder="Örn: PA"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quoteYear">Yıl Kodu</Label>
                                        <Input
                                            id="quoteYear"
                                            value={quoteYear}
                                            onChange={(e) => setQuoteYear(e.target.value)}
                                            placeholder="Örn: 26"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quoteSequence">Sıradaki Numara</Label>
                                        <Input
                                            id="quoteSequence"
                                            type="number"
                                            value={quoteSequence}
                                            onChange={(e) => setQuoteSequence(e.target.value)}
                                            placeholder="Örn: 1"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={saving}>
                                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

