import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, Download } from 'lucide-react';

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
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Cari Hesap Ekstresi</h2>
                        <p className="text-muted-foreground">{account?.title}</p>
                    </div>
                </div>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Yazdır
                </Button>
            </div>

            {/* Printable Content */}
            <div ref={printRef} className="print:p-0">
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
                <Card className="print:shadow-none print:border-2 mb-6">
                    <CardHeader className="print:py-3">
                        <CardTitle className="print:text-lg">Hesap Bilgileri</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground block">Hesap Adı</span>
                                <span className="font-semibold">{account?.title}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Hesap Tipi</span>
                                <Badge variant="outline">
                                    {account?.account_type === 'Customer' ? 'Müşteri' :
                                        account?.account_type === 'Supplier' ? 'Tedarikçi' : 'Her İkisi'}
                                </Badge>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Vergi No</span>
                                <span className="font-mono">{account?.tax_id || '-'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">Telefon</span>
                                <span>{account?.phone || '-'}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Balance Summary */}
                <Card className="print:shadow-none print:border-2 mb-6">
                    <CardContent className="py-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <span className="text-muted-foreground block text-sm">Toplam Borç (Alacağımız)</span>
                                <span className="text-xl font-bold text-green-600">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account?.receivable_balance || 0)}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-sm">Toplam Alacak (Borcumuz)</span>
                                <span className="text-xl font-bold text-red-600">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(account?.payable_balance || 0)}
                                </span>
                            </div>
                            <div className="border-l-2">
                                <span className="text-muted-foreground block text-sm">Net Bakiye</span>
                                <span className={`text-xl font-bold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentBalance)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Transactions Table */}
                <Card className="print:shadow-none print:border-2">
                    <CardHeader className="print:py-3">
                        <CardTitle className="print:text-lg">Hesap Hareketleri</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="print:bg-gray-100">
                                    <TableHead className="print:py-2 print:text-xs">Tarih</TableHead>
                                    <TableHead className="print:py-2 print:text-xs">İşlem Tipi</TableHead>
                                    <TableHead className="print:py-2 print:text-xs">Açıklama</TableHead>
                                    <TableHead className="text-right print:py-2 print:text-xs">Borç</TableHead>
                                    <TableHead className="text-right print:py-2 print:text-xs">Alacak</TableHead>
                                    <TableHead className="text-right print:py-2 print:text-xs">Bakiye</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactionsWithBalance?.map((tx: any, idx: number) => (
                                    <TableRow key={tx.id} className="print:text-xs">
                                        <TableCell className="print:py-1">
                                            {new Date(tx.date).toLocaleDateString('tr-TR')}
                                        </TableCell>
                                        <TableCell className="print:py-1">
                                            <Badge variant="outline" className="print:text-[10px] print:px-1">
                                                {tx.transaction_type === 'Sales Invoice' ? 'Satış Faturası' :
                                                    tx.transaction_type === 'Purchase Invoice' ? 'Alış Faturası' :
                                                        tx.transaction_type === 'Collection' ? 'Tahsilat' :
                                                            tx.transaction_type === 'Payment' ? 'Ödeme' : tx.transaction_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="print:py-1 max-w-[200px] truncate">
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
