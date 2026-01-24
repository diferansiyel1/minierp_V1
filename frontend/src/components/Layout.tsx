import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
    TrendingDown,
    Settings,
    Upload,
    Menu,
    Search,
    FileText,
    FileArchive,
    LogOut
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
        title: 'Bordro',
        items: [
            { name: 'Personel Kartları', path: '/payroll/employees', icon: Users },
            { name: 'Bordro Hesaplama', path: '/payroll/process', icon: ClipboardList },
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
            { name: 'Teknokent Raporları', path: '/technopark-reports', icon: FileText },
            { name: 'Ayarlar', path: '/settings', icon: Settings },
        ]
    }
];

// Combine static and dynamic nav
const useNavGroups = () => {
    const { user } = useAuth();

    // Clone logic or simple conditional
    const dynamicGroups = [...navGroups];

    if (user?.role === 'superadmin') {
        // Insert or Appending logic
        dynamicGroups.unshift({
            title: 'Yönetim',
            items: [
                { name: 'Kiracılar (Tenants)', path: '/tenants', icon: Building2 }
            ]
        });
    }

    return dynamicGroups;
};

const NavContent = ({ location, setOpen }: { location: any, setOpen?: (open: boolean) => void }) => {
    const groups = useNavGroups();

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-6 flex items-center gap-2 border-b border-gray-100">
                <div className="bg-violet-100 p-1 rounded-lg">
                    <Building2 className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-violet-700 tracking-tight leading-none">
                        MiniERP
                    </h1>
                    <p className="text-[10px] text-gray-500 font-medium">Ön Muhasebe & CRM</p>
                </div>
            </div>

            <nav className="flex-1 flex flex-col px-4 py-4 overflow-y-auto gap-1">
                {groups.map((group, groupIndex) => (
                    <div key={groupIndex} className={cn(groupIndex > 0 && "mt-4")}>
                        {group.title && (
                            <h3 className="px-2 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {group.title}
                            </h3>
                        )}
                        <div className="space-y-0.5">
                            {group.items.map((item) => (
                                <Link key={item.path} to={item.path} onClick={() => setOpen?.(false)}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start text-gray-500 hover:text-violet-600 hover:bg-violet-50 h-9 font-medium",
                                            location.pathname === item.path && "text-violet-600 bg-violet-50 font-semibold"
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

            <div className="p-4 border-t bg-gray-50/50">
                <p className="text-[10px] text-gray-400 text-center">
                    v2.1.0 · Pikolab Arge
                </p>
            </div>
        </div>
    );

};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const [open, setOpen] = React.useState(false);
    const { user, logout } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

    return (
        <div className="flex h-screen bg-[#F3F4F6]">
            {/* Mobile Sidebar (Sheet) */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden fixed top-3 left-3 z-50 bg-white shadow-sm border">
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 border-r-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Menu</SheetTitle>
                        <SheetDescription>Navigation</SheetDescription>
                    </SheetHeader>
                    <NavContent location={location} setOpen={setOpen} />
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <aside className="w-64 bg-white shadow-sm hidden md:flex flex-col z-20">
                <NavContent location={location} />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Header */}
                <header className="h-20 bg-[#F3F4F6] px-8 flex items-center justify-between shrink-0">
                    <div className="flex-1 max-w-2xl">
                        {/* Search Bar - Centered-ish */}
                        <div className="relative w-full max-w-md mx-auto hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Ara..."
                                className="pl-10 bg-white border-transparent focus:border-violet-200 shadow-sm rounded-full h-10"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="text-gray-500">
                            <Upload className="h-5 w-5" />
                        </Button>
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 pl-4 border-l hover:bg-gray-50 transition-colors rounded-l-lg p-1"
                            >
                                <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold border-2 border-white shadow-sm">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </div>
                                <div className="hidden lg:block text-right">
                                    <p className="text-sm font-bold text-gray-800 leading-none">{user?.full_name || 'Kullanıcı'}</p>
                                    <p className="text-xs text-gray-500 capitalize">{user?.role || 'User'}</p>
                                </div>
                            </button>

                            {isUserMenuOpen && (
                                <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                                    <div className="px-4 py-2 border-b">
                                        <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsUserMenuOpen(false);
                                            logout();
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Çıkış Yap
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Hoş Geldiniz</h1>
                            <p className="text-sm text-gray-500">
                                {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
