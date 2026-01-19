import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer } from 'lucide-react';

const AccountLedger = () => {
    const { accountId } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const { data: account } = useQuery({
        queryKey: ['account', accountId],
        queryFn: async () => (await api.get(`/accounts/${accountId}`)).data
    });

    const { data: transactions, isLoading } = useQuery({
        queryKey: ['ledger', accountId],
        queryFn: async () => (await api.get(`/accounts/${accountId}/ledger`)).data
    });

    const handlePrint = () => {
        window.print();
    };

    // Calculate running balance
    const getTransactionsWithBalance = () => {
        if (!transactions) return [];

        let runningBalance = 0;
        // Reverse to process oldest first, then reverse back
        const sorted = [...transactions].reverse();
        const withBalance = sorted.map((tx: any) => {
            runningBalance += (tx.debit || 0) - (tx.credit || 0);
            return { ...tx, balance: runningBalance };
        });
        return withBalance.reverse(); // Back to newest first
    };

    const transactionsWithBalance = getTransactionsWithBalance();
    const currentBalance = (account?.receivable_balance || 0) - (account?.payable_balance || 0);

    if (isLoading) return <div>Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header - Hidden on print */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Cari Hesap Ekstresi</h2>
                        <p className="text-muted-foreground">{account?.title}</p>
                    </div>
                </div>
                <Button onClick={handlePrint} className="w-full md:w-auto">
                    <Printer className="mr-2 h-4 w-4" /> Yazdır
                </Button>
            </div>

            {/* Printable Content */}
            <div ref={printRef} className="print:p-0 space-y-6">
                {/* Print Header */}
                <div className="hidden print:block mb-8">
                    <div className="text-center border-b-2 border-black pb-4 mb-4">
                        <h1 className="text-2xl font-bold">CARİ HESAP EKSTRESİ</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Tarih: {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Account Info Card */}
                <Card className="print:shadow-none print:border-2">
                    <CardHeader className="print:py-3">
                        <CardTitle className="print:text-lg">Hesap Bilgileri</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block text-xs md:text-sm">Hesap Adı</span>
                                <span className="font-semibold">{account?.title}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs md:text-sm">Hesap Tipi</span>
                                <Badge variant="outline">
                                    {account?.account_type === 'Customer' ? 'Müşteri' :
                                        account?.account_type === 'Supplier' ? 'Tedarikçi' : 'Her İkisi'}
                                </Badge>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs md:text-sm">Vergi No</span>
                                <span className="font-mono">{account?.tax_id || '-'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs md:text-sm">Telefon</span>
                                <span>{account?.phone || '-'}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Balance Summary */}
                <Card className="print:shadow-none print:border-2">
                    <CardContent className="py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center divide-y md:divide-y-0 md:divide-x">
                            <div className="pt-2 md:pt-0">
                                <span className="text-muted-foreground block text-sm">Toplam Borç (Alacağımız)</span>
                                <span className="text-xl font-bold text-green-600">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account?.receivable_balance || 0)}
                                </span>
                            </div>
                            <div className="pt-2 md:pt-0">
                                <span className="text-muted-foreground block text-sm">Toplam Alacak (Borcumuz)</span>
                                <span className="text-xl font-bold text-red-600">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account?.payable_balance || 0)}
                                </span>
                            </div>
                            <div className="pt-2 md:pt-0">
                                <span className="text-muted-foreground block text-sm">Net Bakiye</span>
                                <span className={`text-xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentBalance)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Transactions Table - Desktop & Print */}
                <Card className="print:shadow-none print:border-2 hidden md:block print:block">
                    <CardHeader className="print:py-3 px-4 py-3 border-b bg-muted/30">
                        <CardTitle className="print:text-lg text-sm font-medium">Hesap Hareketleri (Masaüstü)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="print:bg-gray-100 hover:bg-transparent">
                                    <TableHead className="print:py-2 print:text-xs w-[120px]">Tarih</TableHead>
                                    <TableHead className="print:py-2 print:text-xs w-[140px]">İşlem Tipi</TableHead>
                                    <TableHead className="print:py-2 print:text-xs">Açıklama</TableHead>
                                    <TableHead className="text-right print:py-2 print:text-xs w-[120px]">Borç</TableHead>
                                    <TableHead className="text-right print:py-2 print:text-xs w-[120px]">Alacak</TableHead>
                                    <TableHead className="text-right print:py-2 print:text-xs w-[120px]">Bakiye</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactionsWithBalance?.map((tx: any) => (
                                    <TableRow key={tx.id} className="print:text-xs hover:bg-muted/50">
                                        <TableCell className="print:py-1">
                                            {new Date(tx.date).toLocaleDateString('tr-TR')}
                                        </TableCell>
                                        <TableCell className="print:py-1">
                                            <Badge variant="outline" className="print:text-[10px] print:px-1 bg-white font-normal text-xs">
                                                {tx.transaction_type === 'Sales Invoice' ? 'Satış Faturası' :
                                                    tx.transaction_type === 'Purchase Invoice' ? 'Alış Faturası' :
                                                        tx.transaction_type === 'Collection' ? 'Tahsilat' :
                                                            tx.transaction_type === 'Payment' ? 'Ödeme' : tx.transaction_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="print:py-1 max-w-[200px] truncate text-muted-foreground">
                                            {tx.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono print:py-1">
                                            {tx.debit > 0
                                                ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.debit)
                                                : '-'
                                            }
                                        </TableCell>
                                        <TableCell className="text-right font-mono print:py-1">
                                            {tx.credit > 0
                                                ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.credit)
                                                : '-'
                                            }
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-bold print:py-1 ${tx.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.balance)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!transactions || transactions.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Bu hesaba ait hareket bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Transactions Card View - Mobile Only */}
                <div className="md:hidden space-y-4 print:hidden">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Hesap Hareketleri</h3>
                    {transactionsWithBalance?.map((tx: any) => (
                        <Card key={tx.id} className="shadow-sm">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant="outline" className="bg-muted/50 font-normal">
                                            {tx.transaction_type === 'Sales Invoice' ? 'Satış Fat.' :
                                                tx.transaction_type === 'Purchase Invoice' ? 'Alış Fat.' :
                                                    tx.transaction_type === 'Collection' ? 'Tahsilat' :
                                                        tx.transaction_type === 'Payment' ? 'Ödeme' : tx.transaction_type}
                                        </Badge>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {new Date(tx.date).toLocaleDateString('tr-TR')}
                                        </div>
                                    </div>
                                    <div className={`font-mono font-bold ${tx.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.balance)}
                                        <div className="text-[10px] text-gray-400 font-normal text-right">Bakiye</div>
                                    </div>
                                </div>

                                {tx.description && (
                                    <div className="text-sm text-gray-700 bg-muted/20 p-2 rounded">
                                        {tx.description}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 border-t pt-2 mt-2">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground">Borç</div>
                                        <div className="text-sm font-mono">
                                            {tx.debit > 0
                                                ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.debit)
                                                : '-'
                                            }
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-muted-foreground">Alacak</div>
                                        <div className="text-sm font-mono">
                                            {tx.credit > 0
                                                ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.credit)
                                                : '-'
                                            }
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {(!transactions || transactions.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground bg-white rounded-lg border border-dashed">
                            Bu hesaba ait hareket bulunamadı.
                        </div>
                    )}
                </div>

                {/* Print Footer */}
                <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-500">
                    <div className="flex justify-between">
                        <span>MiniERP Ön Muhasebe Sistemi</span>
                        <span>Sayfa 1</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountLedger;
