import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingsService, TaxParameters2026, TaxParametersUpdate } from '@/services/settings';
import { toast } from 'sonner';
import { AlertTriangle, Calculator, FileText, Download } from 'lucide-react';


export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Company Settings State
    const [companySettings, setCompanySettings] = useState({
        company_name: '',
        tax_id: '',
        tax_office: '',
        sgk_workplace_no: '',
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

    // Tax Parameters State
    const [taxParams, setTaxParams] = useState<TaxParameters2026 | null>(null);
    const [taxSaving, setTaxSaving] = useState(false);

    // Report Generation State
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
    const [generatingReport, setGeneratingReport] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);

            // Load Company Info
            try {
                const companyInfo = await settingsService.getCompanyInfo();
                if (companyInfo) {
                    setCompanySettings({
                        company_name: companyInfo.company_name || '',
                        tax_id: companyInfo.tax_id || '',
                        tax_office: companyInfo.tax_office || '',
                        sgk_workplace_no: companyInfo.sgk_workplace_no || '',
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
                console.log("Company info fetch failed", err);
            }

            // Load Tax Parameters
            try {
                const params = await settingsService.getTaxParameters(2026);
                setTaxParams(params);
            } catch (err) {
                console.log("Tax parameters fetch failed", err);
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

    const handleSaveTaxParameters = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taxParams) return;

        try {
            setTaxSaving(true);

            // Validasyon
            const rates = [
                { name: 'Girişim Sermayesi Oranı', value: taxParams.venture_capital_rate },
                { name: 'Kurumlar Vergisi Oranı', value: taxParams.corporate_tax_rate },
                { name: 'KDV Oranı', value: taxParams.vat_rate },
                { name: 'Bilişim Personeli Uzaktan Çalışma', value: taxParams.remote_work_rate_informatics },
                { name: 'Diğer Personel Uzaktan Çalışma', value: taxParams.remote_work_rate_other },
                { name: 'SGK İşveren Hissesi İndirimi', value: taxParams.sgk_employer_share_discount },
            ];

            for (const rate of rates) {
                if (rate.value < 0 || rate.value > 1) {
                    toast.error(`${rate.name} 0-1 arasında olmalıdır.`);
                    return;
                }
            }

            const updates: TaxParametersUpdate = {
                venture_capital_limit: taxParams.venture_capital_limit,
                venture_capital_rate: taxParams.venture_capital_rate,
                venture_capital_max_amount: taxParams.venture_capital_max_amount,
                remote_work_rate_informatics: taxParams.remote_work_rate_informatics,
                remote_work_rate_other: taxParams.remote_work_rate_other,
                income_tax_exemptions: taxParams.income_tax_exemptions,
                corporate_tax_rate: taxParams.corporate_tax_rate,
                vat_rate: taxParams.vat_rate,
                daily_food_exemption: taxParams.daily_food_exemption,
                daily_transport_exemption: taxParams.daily_transport_exemption,
                sgk_employer_share_discount: taxParams.sgk_employer_share_discount,
                stamp_tax_exemption_rate: taxParams.stamp_tax_exemption_rate,
            };

            const result = await settingsService.updateTaxParameters(updates, 2026);
            setTaxParams(result);
            toast.success('Vergi parametreleri başarıyla güncellendi.');
        } catch (error: any) {
            console.error('Error saving tax parameters:', error);
            toast.error(error.response?.data?.detail || 'Vergi parametreleri kaydedilirken bir hata oluştu.');
        } finally {
            setTaxSaving(false);
        }
    };

    const handleGenerateReport = async () => {
        try {
            setGeneratingReport(true);
            const blob = await settingsService.generateMonthlyExemptionReport(reportYear, reportMonth);

            // Download file
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const monthNames = ['', 'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
                'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];
            a.download = `Teknokent_Muafiyet_Raporu_${monthNames[reportMonth]}_${reportYear}.pdf`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('Rapor başarıyla oluşturuldu ve indirildi.');
        } catch (error: any) {
            console.error('Error generating report:', error);
            toast.error(error.response?.data?.detail || 'Rapor oluşturulurken bir hata oluştu.');
        } finally {
            setGeneratingReport(false);
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

    const formatPercent = (value: number) => `%${(value * 100).toFixed(0)}`;

    if (loading) {
        return <div className="p-8">Yükleniyor...</div>;
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Sistem Ayarları</h2>
                <p className="text-muted-foreground mt-2">
                    Firma bilgileri, vergi parametreleri ve uygulama konfigürasyonlarını buradan yönetebilirsiniz.
                </p>
            </div>

            <Tabs defaultValue="company" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="company">Firma Bilgileri</TabsTrigger>
                    <TabsTrigger value="quotes">Teklif Ayarları</TabsTrigger>
                    <TabsTrigger value="tax">Vergi & Muafiyet Parametreleri</TabsTrigger>
                    <TabsTrigger value="reports">Raporlar</TabsTrigger>
                </TabsList>

                <TabsContent value="company">
                    <Card>
                        <CardHeader>
                            <CardTitle>Firma Künyesi</CardTitle>
                            <CardDescription>
                                Bu alanlar fatura ve teklif şablonlarında kullanılacaktır.
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
                                    <div className="space-y-2">
                                        <Label>SGK İşyeri No</Label>
                                        <Input
                                            value={companySettings.sgk_workplace_no}
                                            onChange={(e) => setCompanySettings({ ...companySettings, sgk_workplace_no: e.target.value })}
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

                <TabsContent value="tax">
                    <div className="space-y-6">
                        {/* Warning Banner */}
                        <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-semibold text-amber-800">5746/4691 Sayılı Kanun</h4>
                                        <p className="text-sm text-amber-700 mt-1">
                                            Bu parametreler Teknokent vergi istisnaları için kullanılmaktadır.
                                            Değişiklikler tüm vergi hesaplamalarını etkileyecektir.
                                            Lütfen mali müşavirinize danışarak güncelleyin.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {taxParams && (
                            <form onSubmit={handleSaveTaxParameters}>
                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* Girişim Sermayesi */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Calculator className="h-5 w-5" />
                                                Girişim Sermayesi Yükümlülüğü
                                            </CardTitle>
                                            <CardDescription>
                                                İstisna matrahı belirtilen limiti aştığında girişim sermayesi yatırımı zorunludur.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>İstisna Sınırı (TL)</Label>
                                                <Input
                                                    type="number"
                                                    value={taxParams.venture_capital_limit}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        venture_capital_limit: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatCurrency(taxParams.venture_capital_limit)}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Yükümlülük Oranı</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.venture_capital_rate}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        venture_capital_rate: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.venture_capital_rate)}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Maksimum Matrah (TL)</Label>
                                                <Input
                                                    type="number"
                                                    value={taxParams.venture_capital_max_amount}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        venture_capital_max_amount: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Vergi Oranları */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Vergi Oranları</CardTitle>
                                            <CardDescription>
                                                Kurumlar Vergisi ve KDV istisna hesaplamaları için
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Kurumlar Vergisi Oranı</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.corporate_tax_rate}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        corporate_tax_rate: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.corporate_tax_rate)}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>KDV Oranı</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.vat_rate}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        vat_rate: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.vat_rate)}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Uzaktan Çalışma Oranları */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Uzaktan Çalışma Oranları</CardTitle>
                                            <CardDescription>
                                                Personel teşviklerinin uzaktan çalışmada uygulanma oranları
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Bilişim Personeli</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.remote_work_rate_informatics}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        remote_work_rate_informatics: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.remote_work_rate_informatics)} (Yazılımcı, vb.)
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Diğer Personel</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.remote_work_rate_other}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        remote_work_rate_other: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.remote_work_rate_other)} (Destek personeli, vb.)
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Gelir Vergisi İstisna Oranları */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Gelir Vergisi İstisna Oranları</CardTitle>
                                            <CardDescription>
                                                Eğitim durumuna göre personel gelir vergisi istisna oranları
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Doktora + Temel Bilimler</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.income_tax_exemptions.phd_basic_sciences}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        income_tax_exemptions: {
                                                            ...taxParams.income_tax_exemptions,
                                                            phd_basic_sciences: parseFloat(e.target.value) || 0
                                                        }
                                                    })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Yüksek Lisans + Temel Bilimler</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.income_tax_exemptions.masters_basic_sciences}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        income_tax_exemptions: {
                                                            ...taxParams.income_tax_exemptions,
                                                            masters_basic_sciences: parseFloat(e.target.value) || 0
                                                        }
                                                    })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Lisans</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.income_tax_exemptions.bachelors}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        income_tax_exemptions: {
                                                            ...taxParams.income_tax_exemptions,
                                                            bachelors: parseFloat(e.target.value) || 0
                                                        }
                                                    })}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* SGK ve Diğer */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>SGK ve Diğer Teşvikler</CardTitle>
                                            <CardDescription>
                                                İşveren payı ve diğer muafiyet oranları
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>SGK İşveren Hissesi İndirimi</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.sgk_employer_share_discount}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        sgk_employer_share_discount: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.sgk_employer_share_discount)}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Damga Vergisi Muafiyeti</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={taxParams.stamp_tax_exemption_rate}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        stamp_tax_exemption_rate: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Mevcut: {formatPercent(taxParams.stamp_tax_exemption_rate)}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Günlük Muafiyetler */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Günlük Muafiyetler</CardTitle>
                                            <CardDescription>
                                                Yemek ve ulaşım muafiyet tutarları
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Günlük Yemek Muafiyeti (TL)</Label>
                                                <Input
                                                    type="number"
                                                    value={taxParams.daily_food_exemption}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        daily_food_exemption: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Günlük Ulaşım Muafiyeti (TL)</Label>
                                                <Input
                                                    type="number"
                                                    value={taxParams.daily_transport_exemption}
                                                    onChange={(e) => setTaxParams({
                                                        ...taxParams,
                                                        daily_transport_exemption: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="flex justify-end pt-6">
                                    <Button type="submit" disabled={taxSaving} size="lg">
                                        {taxSaving ? 'Kaydediliyor...' : 'Vergi Parametrelerini Kaydet'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="reports">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Aylık Muafiyet Raporu Oluştur
                            </CardTitle>
                            <CardDescription>
                                YMM (Yeminli Mali Müşavir) formatında Teknokent muafiyet raporu oluşturun.
                                Rapor şunları içerir: Proje özeti, Gelir analizi, Personel analizi, Kurumlar vergisi hesaplaması.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Yıl</Label>
                                    <Input
                                        type="number"
                                        value={reportYear}
                                        onChange={(e) => setReportYear(parseInt(e.target.value) || new Date().getFullYear())}
                                        min={2020}
                                        max={2030}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ay</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(parseInt(e.target.value))}
                                    >
                                        <option value={1}>Ocak</option>
                                        <option value={2}>Şubat</option>
                                        <option value={3}>Mart</option>
                                        <option value={4}>Nisan</option>
                                        <option value={5}>Mayıs</option>
                                        <option value={6}>Haziran</option>
                                        <option value={7}>Temmuz</option>
                                        <option value={8}>Ağustos</option>
                                        <option value={9}>Eylül</option>
                                        <option value={10}>Ekim</option>
                                        <option value={11}>Kasım</option>
                                        <option value={12}>Aralık</option>
                                    </select>
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerateReport}
                                disabled={generatingReport}
                                size="lg"
                                className="w-full md:w-auto"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                {generatingReport ? 'Rapor Oluşturuluyor...' : 'PDF Raporu İndir'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
