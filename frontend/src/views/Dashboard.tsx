import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    PiggyBank,
    Target,
    Landmark,
    Calendar,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

const Dashboard = () => {
    const [period, setPeriod] = useState<PeriodType>('monthly');

    const { data: kpis, isLoading: kpisLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const res = await api.get('/finance/dashboard');
            return res.data;
        },
    });

    const { data: chartData, isLoading: chartLoading } = useQuery({
        queryKey: ['income-expense-chart', period],
        queryFn: async () => {
            const res = await api.get(`/finance/charts/income-expense?period=${period}`);
            return res.data;
        },
    });

    const { data: projectChart } = useQuery({
        queryKey: ['project-chart'],
        queryFn: async () => {
            const res = await api.get('/finance/charts/projects');
            return res.data;
        },
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

    const formatShortCurrency = (value: number) => {
        if (value >= 1000000) return `₺${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `₺${(value / 1000).toFixed(0)}K`;
        return `₺${value.toFixed(0)}`;
    };

    if (kpisLoading) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Kontrol Paneli</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {new Date().toLocaleDateString('tr-TR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Alacak</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(kpis?.total_receivables || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Müşterilerden</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Borç</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(kpis?.total_payables || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Tedarikçilere</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Bakiye</CardTitle>
                        <Wallet className="h-4 w-4 text-violet-600" />
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`text-2xl font-bold ${(kpis?.net_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                        >
                            {formatCurrency(kpis?.net_balance || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Alacak - Borç</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Kasa/Banka</CardTitle>
                        <Landmark className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-violet-600">
                            {formatCurrency(kpis?.total_cash_balance || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Toplam nakit</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Satış</CardTitle>
                        <PiggyBank className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            {formatCurrency(kpis?.monthly_sales || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Toplam gelir</p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dönüşüm</CardTitle>
                        <Target className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            %{(kpis?.lead_conversion_rate || 0).toFixed(1)}
                        </div>
                        <p className="text-xs text-muted-foreground">Fırsat → Sipariş</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Income/Expense Chart */}
                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Gelir / Gider Analizi</CardTitle>
                            <div className="flex gap-1">
                                <Button
                                    size="sm"
                                    variant={period === 'monthly' ? 'default' : 'outline'}
                                    onClick={() => setPeriod('monthly')}
                                >
                                    Aylık
                                </Button>
                                <Button
                                    size="sm"
                                    variant={period === 'quarterly' ? 'default' : 'outline'}
                                    onClick={() => setPeriod('quarterly')}
                                >
                                    Çeyreklik
                                </Button>
                                <Button
                                    size="sm"
                                    variant={period === 'yearly' ? 'default' : 'outline'}
                                    onClick={() => setPeriod('yearly')}
                                >
                                    Yıllık
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {chartLoading ? (
                            <div className="h-[300px] flex items-center justify-center"><Spinner /></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData?.data || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelStyle={{ color: '#333' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Profit Trend */}
                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader>
                        <CardTitle>Kâr/Zarar Trendi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {chartLoading ? (
                            <div className="h-[300px] flex items-center justify-center"><Spinner /></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={chartData?.data || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="profit"
                                        name="Net Kâr"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        dot={{ fill: '#6366f1', r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Project Performance */}
            {projectChart?.data?.length > 0 && (
                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-transparent hover:border-t-primary">
                    <CardHeader>
                        <CardTitle>Proje Performansı</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={projectChart.data} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" tickFormatter={formatShortCurrency} />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="budget" name="Bütçe" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Dashboard;
