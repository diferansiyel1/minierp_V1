import React from 'react';
import {
    DndContext,
    DragOverlay,
    useSensors,
    useSensor,
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { Deal } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
    id: string;
    label: string;
    color: string;
    deals: Deal[];
    onDealClick: (deal: Deal) => void;
}

const KanbanCard = ({ deal, onClick, colorClassName }: { deal: Deal; onClick?: () => void, colorClassName?: string }) => {
    // Parse border color from the column bg class to use for the strip
    // e.g., "bg-slate-500/10 border-slate-500/20" -> "bg-slate-500"
    // We'll just hardcode a mapping or use a simple heuristic if needed, 
    // but for now let's apply the color class to the strip directly.

    // Extracting the base color name (e.g. "slate-500") from the complexity of tailwind classes passed as colorClassName
    // `bg-X/10` -> we want `bg-X` for the strip.
    const stripColor = colorClassName?.split(' ')[0].replace('/10', '') || 'bg-gray-500';

    return (
        <Card
            className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative overflow-hidden bg-card"
            onClick={onClick}
        >
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", stripColor)} />
            <CardContent className="p-3 pl-5">
                <div className="font-bold text-sm mb-1">{deal.title}</div>
                <div className="text-xs text-muted-foreground mb-2 truncate">
                    {deal.account?.title || 'Unknown Company'}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-primary">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(deal.estimated_value)}
                    </span>
                    {deal.probability !== undefined && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-background">
                            %{deal.probability}
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const KanbanColumn = ({ id, label, color, deals, onDealClick }: KanbanColumnProps) => {
    // UseDroppable logic would go here if we were using it for strict drop targets,
    // but for simple lists we can just render. 
    // To make it a proper droppable zone:
    const { setNodeRef } = useDroppable({ id });

    return (
        <div ref={setNodeRef} className={cn("flex-1 rounded-lg p-2 border bg-muted/30 flex flex-col min-w-[280px]", color)}>
            <div className="flex justify-between items-center mb-3 px-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-foreground/80">
                    {label}
                </h3>
                <Badge variant="secondary" className="text-xs font-normal">
                    {deals.length}
                </Badge>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto min-h-[100px]">
                {deals.map(deal => (
                    <DraggableDeal key={deal.id} deal={deal} onDealClick={onDealClick} colorClassName={color} />
                ))}
            </div>
        </div>
    );
};

// Wrapper for Draggable
import { useDraggable, useDroppable } from '@dnd-kit/core';

const DraggableDeal = ({ deal, onDealClick, colorClassName }: { deal: Deal, onDealClick: (d: Deal) => void, colorClassName: string }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: deal.id.toString(),
        data: { deal }
    });

    if (isDragging) {
        return (
            <div ref={setNodeRef} className="opacity-50">
                <KanbanCard deal={deal} colorClassName={colorClassName} />
            </div>
        );
    }

    return (
        <div ref={setNodeRef} {...listeners} {...attributes}>
            <KanbanCard deal={deal} onClick={() => onDealClick(deal)} colorClassName={colorClassName} />
        </div>
    );
};

interface KanbanBoardProps {
    deals: Deal[];
    columns: { id: string; label: string; color: string }[];
    onDragEnd: (event: DragEndEvent) => void;
    onDealClick: (deal: Deal) => void;
}

export const KanbanBoard = ({ deals, columns, onDragEnd, onDealClick }: KanbanBoardProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const [activeDeal, setActiveDeal] = React.useState<Deal | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDeal(event.active.data.current?.deal);
    };

    const internalDragEnd = (event: DragEndEvent) => {
        setActiveDeal(null);
        onDragEnd(event);
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={internalDragEnd}
        >
            <div className="flex h-full gap-4 overflow-x-auto pb-4">
                {columns.map(col => (
                    <KanbanColumn
                        key={col.id}
                        id={col.id}
                        label={col.label}
                        color={col.color}
                        deals={deals.filter(d => d.status === col.id)}
                        onDealClick={onDealClick}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeDeal ? (
                    <div className="w-[280px]">
                        <KanbanCard deal={activeDeal} colorClassName="bg-primary/20" />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
