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
    Building2
} from 'lucide-react';

const navItems = [
    { name: 'Kontrol Paneli', path: '/', icon: LayoutDashboard },
    { name: 'Cari Hesaplar', path: '/customers', icon: Users },
    { name: 'Ürün & Hizmetler', path: '/products', icon: Package },
    { name: 'Satış Fırsatları', path: '/deals', icon: Target },
    { name: 'Teklifler', path: '/quotes', icon: ClipboardList },
    { name: 'Faturalar', path: '/invoices', icon: Receipt },
    { name: 'Finans', path: '/finance', icon: Wallet },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-white shadow-sm hidden md:flex flex-col">
                <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-white" />
                        <div>
                            <h1 className="text-xl font-bold text-white">
                                MiniERP
                            </h1>
                            <p className="text-xs text-blue-100">Ön Muhasebe & CRM</p>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 flex flex-col space-y-1 px-3 py-4">
                    {navItems.map((item) => (
                        <Link key={item.path} to={item.path}>
                            <Button
                                variant={location.pathname === item.path ? "default" : "ghost"}
                                className={cn(
                                    "w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100",
                                    location.pathname === item.path && "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                )}
                            >
                                <item.icon className="mr-3 h-4 w-4" />
                                {item.name}
                            </Button>
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        v1.0.0 · Türkiye
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
