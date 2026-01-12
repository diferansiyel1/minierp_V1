import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { settingsService } from '@/services/settings';
import { toast } from 'sonner';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
            const allSettings = await settingsService.getAll();

            const prefix = allSettings.find(s => s.key === 'quote_prefix');
            const year = allSettings.find(s => s.key === 'quote_year');
            const sequence = allSettings.find(s => s.key === 'quote_sequence');

            if (prefix) setQuotePrefix(prefix.value);
            if (year) setQuoteYear(year.value);
            if (sequence) setQuoteSequence(sequence.value);

        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Ayarlar yüklenirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuoteSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            await Promise.all([
                settingsService.update('quote_prefix', quotePrefix, 'Teklif No Öneki'),
                settingsService.update('quote_year', quoteYear, 'Teklif No Yılı'),
                settingsService.update('quote_sequence', quoteSequence, 'Sıradaki Teklif Numarası'),
            ]);
            toast.success('Teklif ayarları başarıyla kaydedildi.');
        } catch (error) {
            console.error('Error saving settings:', error);
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
                    Uygulama genelindeki konfigürasyonları buradan yönetebilirsiniz.
                </p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Teklif Konfigürasyonu</CardTitle>
                        <CardDescription>
                            Teklif numaralarının nasıl oluşturulacağını belirleyin.
                            Örnek format: {quotePrefix}{quoteYear}{quoteSequence.padStart(3, '0')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSaveQuoteSettings} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="quotePrefix">Ön Ek</Label>
                                    <Input
                                        id="quotePrefix"
                                        value={quotePrefix}
                                        onChange={(e) => setQuotePrefix(e.target.value)}
                                        placeholder="Örn: PA"
                                    />
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Teklif numarasının başındaki harf grubu.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="quoteYear">Yıl Kodu</Label>
                                    <Input
                                        id="quoteYear"
                                        value={quoteYear}
                                        onChange={(e) => setQuoteYear(e.target.value)}
                                        placeholder="Örn: 26"
                                    />
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Ön ekten sonra gelen yıl ibaresi.
                                    </p>
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
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Bir sonraki teklifin alacağı sıra numarası.
                                    </p>
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
            </div>
        </div>
    );
}
