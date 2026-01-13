import React from 'react';
import {
    Phone,
    Mail,
    FileText,
    DollarSign,
    Calendar,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface TimelineEvent {
    id: number;
    type: 'call' | 'email' | 'meeting' | 'note' | 'quote' | 'sale';
    title: string;
    description?: string;
    date: string;
    user?: string;
}

interface TimelineProps {
    events: TimelineEvent[];
}

const getIcon = (type: string) => {
    switch (type) {
        case 'call': return <Phone className="h-4 w-4" />;
        case 'email': return <Mail className="h-4 w-4" />;
        case 'quote': return <FileText className="h-4 w-4" />;
        case 'sale': return <DollarSign className="h-4 w-4" />;
        case 'meeting': return <Calendar className="h-4 w-4" />;
        default: return <CheckCircle2 className="h-4 w-4" />;
    }
};

const getColor = (type: string) => {
    switch (type) {
        case 'call': return 'bg-blue-100 text-blue-600 border-blue-200';
        case 'email': return 'bg-slate-100 text-slate-600 border-slate-200';
        case 'quote': return 'bg-purple-100 text-purple-600 border-purple-200'; // Pikolab Purple nuance
        case 'sale': return 'bg-green-100 text-green-600 border-green-200';
        case 'meeting': return 'bg-orange-100 text-orange-600 border-orange-200';
        default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

export const AccountTimeline = ({ events }: TimelineProps) => {
    return (
        <div className="space-y-8 p-4">
            {events.map((event, index) => (
                <div key={event.id} className="relative flex gap-6">
                    {/* Line connecting events */}
                    {index !== events.length - 1 && (
                        <div className="absolute left-[19px] top-10 bottom-[-32px] w-0.5 bg-primary/20" />
                    )}

                    {/* Icon Bubble */}
                    <div className={cn(
                        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
                        getColor(event.type)
                    )}>
                        {getIcon(event.type)}
                    </div>

                    {/* Content Card */}
                    <Card className="flex-1 mb-2">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-semibold text-sm">{event.title}</h4>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {new Date(event.date).toLocaleString('tr-TR', {
                                        day: 'numeric',
                                        month: 'long',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                            {event.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {event.description}
                                </p>
                            )}
                            {event.type === 'sale' && (
                                <Badge variant="secondary" className="mt-2 bg-green-50 text-green-700 hover:bg-green-100">
                                    Satış Tamamlandı
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ))}

            {events.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    Henüz bir aktivite kaydı yok.
                </div>
            )}
        </div>
    );
};
