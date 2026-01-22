import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { settingsService } from '@/services/settings';
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    PiggyBank,
    Target,
    Landmark,
    MoreVertical,
    Shield
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    RadialBarChart,
    RadialBar,
    Legend
} from 'recharts';
import { Spinner } from '@/components/ui/spinner';

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

interface KpiStat {
    label: string;
    value: string;
    subLabel: string;
    trend?: 'up' | 'down' | 'neutral';
    iconColor: string;
    iconBg: string; // Removed duplicate declaration if any
    icon: React.ReactNode;
}

const Dashboard = () => {
    const [period, setPeriod] = useState<PeriodType>('monthly');

    const { data: kpis, isLoading: kpisLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const res = await api.get('/finance/dashboard');
            return res.data;
        },
    });

    const { data: chartData } = useQuery({
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

    const { data: yearlyTaxSummary } = useQuery({
        queryKey: ['yearly-tax-summary', new Date().getFullYear()],
        queryFn: async () => {
            try {
                return await settingsService.getYearlyTaxSummary(new Date().getFullYear());
            } catch {
                return null;
            }
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

    // Transform API data to new StatsCard format (Turkish content)
    const stats: KpiStat[] = [
        {
            label: 'Toplam Alacak',
            value: formatCurrency(kpis?.total_receivables || 0),
            subLabel: 'Müşterilerden',
            trend: 'up',
            iconColor: 'text-green-600',
            iconBg: 'bg-green-50',
            icon: <TrendingUp className="w-6 h-6" />
        },
        {
            label: 'Toplam Borç',
            value: formatCurrency(kpis?.total_payables || 0),
            subLabel: 'Tedarikçilere',
            trend: 'down',
            iconColor: 'text-red-600',
            iconBg: 'bg-red-50',
            icon: <TrendingDown className="w-6 h-6" />
        },
        {
            label: 'Net Bakiye',
            value: formatCurrency(kpis?.net_balance || 0),
            subLabel: 'Alacak - Borç',
            trend: (kpis?.net_balance || 0) >= 0 ? 'up' : 'down',
            iconColor: 'text-violet-600',
            iconBg: 'bg-violet-50',
            icon: <Wallet className="w-6 h-6" />
        },
        {
            label: 'Kasa/Banka',
            value: formatCurrency(kpis?.total_cash_balance || 0),
            subLabel: 'Toplam Mevcut',
            trend: 'neutral',
            iconColor: 'text-purple-600',
            iconBg: 'bg-purple-50',
            icon: <Landmark className="w-6 h-6" />
        },
        {
            label: 'Vergi İstisnası',
            value: formatCurrency(yearlyTaxSummary?.total_tax_advantage || 0),
            subLabel: `${new Date().getFullYear()} Yılı Tahmini`,
            trend: 'up',
            iconColor: 'text-teal-600',
            iconBg: 'bg-teal-50',
            icon: <Shield className="w-6 h-6" />
        }
    ];

    const StatsCard = ({ stat }: { stat: KpiStat }) => (
        <Card className="border shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${stat.iconBg} ${stat.iconColor}`}>
                        {stat.icon}
                    </div>
                    <div>
                        <div className="text-lg font-bold text-gray-900">{stat.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                        <div className="text-[10px] text-gray-400">{stat.subLabel}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6 pb-12">
            {/* KPI Row - Keeping new style */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {stats.map((stat, i) => <StatsCard key={i} stat={stat} />)}
            </div>

            {/* Charts Row - Using new chart components but old data */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* 1. Conversion Rate (Using RadialBar) - Keeping visual of 'Staff Application' but using 'Conversion' Data */}
                <Card className="shadow-sm border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-bold">Dönüşüm Oranı</CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-0 pb-6 relative">
                        <div className="h-[200px] w-full relative flex justify-center items-center" style={{ height: 200 }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                                <span className="text-3xl font-bold">%{(kpis?.lead_conversion_rate || 0).toFixed(1)}</span>
                                <span className="text-xs text-gray-500">Başarı</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <RadialBarChart
                                    innerRadius="70%"
                                    outerRadius="100%"
                                    barSize={15}
                                    data={[{ name: 'Conversion', value: kpis?.lead_conversion_rate || 0, fill: '#8b5cf6' }]}
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    <RadialBar background dataKey="value" />
                                </RadialBarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Income/Expense (Using BarChart) - Visual of 'Annual Payroll' */}
                <Card className="shadow-sm border lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center justify-between w-full">
                            <CardTitle className="text-base font-bold">Gelir / Gider Analizi</CardTitle>
                            <div className="flex gap-1">
                                <Button size="sm" variant={period === 'monthly' ? 'default' : 'outline'} onClick={() => setPeriod('monthly')} className="h-7 text-xs">Ay</Button>
                                <Button size="sm" variant={period === 'quarterly' ? 'default' : 'outline'} onClick={() => setPeriod('quarterly')} className="h-7 text-xs">Çeyrek</Button>
                                <Button size="sm" variant={period === 'yearly' ? 'default' : 'outline'} onClick={() => setPeriod('yearly')} className="h-7 text-xs">Yıl</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 pb-4 px-4">
                        <div className="h-[240px] w-full" style={{ height: 240 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={chartData?.data || []} barSize={20}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
                                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                    <Legend />
                                    <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row - Charts from old dashboard (Profit Trend & Projects) */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* 3. Profit Trend (Using AreaChart) - Visual of 'Total Income' */}
                <Card className="shadow-sm border">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-bold">Net Kâr Trendi</CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><TrendingUp className="h-4 w-4" /></Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="h-[200px] w-full" style={{ height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <AreaChart data={chartData?.data || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
                                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                    <Area type="monotone" dataKey="profit" name="Net Kâr" stroke="#6366f1" fillOpacity={1} fill="url(#colorProfit)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Project Performance (Bar Chart) - New visual container */}
                {projectChart?.data?.length > 0 && (
                    <Card className="shadow-sm border">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base font-bold">Proje Performansı</CardTitle>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Target className="h-4 w-4" /></Button>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="h-[200px] w-full" style={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <BarChart data={projectChart.data} layout="vertical" barSize={10}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tickFormatter={formatShortCurrency} tick={{ fontSize: 10 }} />
                                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                                        <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
