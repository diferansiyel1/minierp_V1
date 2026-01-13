import React from 'react';
import { Deal } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DealListProps {
    deals: Deal[];
    onDealClick: (deal: Deal) => void;
}

export const DealList = ({ deals, onDealClick }: DealListProps) => {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fırsat Başlığı</TableHead>
                        <TableHead>Müşteri</TableHead>
                        <TableHead>Değer</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>Kaynak</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deals.map((deal) => (
                        <TableRow
                            key={deal.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => onDealClick(deal)}
                        >
                            <TableCell className="font-medium">{deal.title}</TableCell>
                            <TableCell>{deal.account?.title || '-'}</TableCell>
                            <TableCell>
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(deal.estimated_value)}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">{deal.status}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{deal.source || '-'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
