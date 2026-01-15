import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    Package,
    Target,
    Wallet,
    Receipt,
    ClipboardList,
    Building2,
    FolderKanban,
    Landmark,
    FileText,
    TrendingDown,
    Settings,
    FileArchive,
    Upload
} from 'lucide-react';

interface NavItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
    title: string | null;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        title: null,
        items: [
            { name: 'Kontrol Paneli', path: '/', icon: LayoutDashboard },
            { name: 'Projeler', path: '/projects', icon: FolderKanban },
            { name: 'Cari Hesaplar', path: '/customers', icon: Users },
            { name: 'Kişiler', path: '/contacts', icon: Users },
            { name: 'Ürün & Hizmetler', path: '/products', icon: Package },
        ]
    },
    {
        title: 'Satış Yönetimi',
        items: [
            { name: 'Satış Fırsatları', path: '/deals', icon: Target },
            { name: 'Teklifler', path: '/quotes', icon: ClipboardList },
            { name: 'Satış Faturaları', path: '/sales-invoices', icon: Receipt },
        ]
    },
    {
        title: 'Gider Yönetimi',
        items: [
            { name: 'Gider Faturaları', path: '/expenses', icon: TrendingDown },
        ]
    },
    {
        title: 'Finans',
        items: [
            { name: 'Tüm Faturalar', path: '/invoices', icon: FileText },
            { name: 'Kasa & Banka', path: '/financial-accounts', icon: Landmark },
            { name: 'Finans Özeti', path: '/finance', icon: Wallet },
        ]
    },
    {
        title: 'Sistem',
        items: [
            { name: 'e-Arşiv Portal', path: '/earsiv', icon: FileArchive },
            { name: 'CSV Import', path: '/csv-import', icon: Upload },
            { name: 'Ayarlar', path: '/settings', icon: Settings },
        ]
    }
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-white shadow-sm hidden md:flex flex-col">
                <div className="p-6 border-b bg-gradient-to-r from-violet-700 to-violet-600">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-white" />
                        <div>
                            <h1 className="text-xl font-bold text-white">
                                MiniERP
                            </h1>
                            <p className="text-xs text-violet-100">Ön Muhasebe & CRM</p>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 flex flex-col px-3 py-4 overflow-y-auto">
                    {navGroups.map((group, groupIndex) => (
                        <div key={groupIndex} className={cn(groupIndex > 0 && "mt-4")}>
                            {group.title && (
                                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {group.title}
                                </h3>
                            )}
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <Link key={item.path} to={item.path}>
                                        <Button
                                            variant={location.pathname === item.path ? "default" : "ghost"}
                                            className={cn(
                                                "w-full justify-start text-gray-600 hover:text-violet-700 hover:bg-violet-50",
                                                location.pathname === item.path && "bg-violet-600 text-white hover:bg-violet-700 hover:text-white"
                                            )}
                                        >
                                            <item.icon className="mr-3 h-4 w-4" />
                                            {item.name}
                                        </Button>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
                <div className="p-4 border-t bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        v2.1.0 · Pikolab Arge
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
                {children}
            </main>
        </div>
    );
};

export default Layout;
