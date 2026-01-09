import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Users, Target } from 'lucide-react';

const Dashboard = () => {
    const { data: kpis, isLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const res = await api.get('/finance/dashboard');
            return res.data;
        }
    });

    if (isLoading) return <div>Yükleniyor...</div>;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Kontrol Paneli</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Alacak</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">
                            {formatCurrency(kpis?.total_receivables || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Müşterilerden alınacak tutar</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Borç</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                            {formatCurrency(kpis?.total_payables || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Tedarikçilere ödenecek tutar</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Bakiye</CardTitle>
                        <Wallet className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${(kpis?.net_balance || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(kpis?.net_balance || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Alacak - Borç</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Satış</CardTitle>
                        <PiggyBank className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(kpis?.monthly_sales || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Satış faturaları toplamı</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Gider</CardTitle>
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(kpis?.monthly_expenses || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Gider faturaları toplamı</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dönüşüm Oranı</CardTitle>
                        <Target className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            %{(kpis?.lead_conversion_rate || 0).toFixed(1)}
                        </div>
                        <p className="text-xs text-muted-foreground">Fırsattan siparişe</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
