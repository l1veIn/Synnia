import { Button } from '@/components/ui/button';
import { CheckSquare, Square, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionsProps {
    onSelectAll: () => void;
    onSelectNone: () => void;
    onInvertSelection: () => void;
    selectedCount: number;
    totalCount: number;
    mode: 'single' | 'multi';
    className?: string;
}

/**
 * BulkActions - Select all/none/invert controls
 */
export function BulkActions({
    onSelectAll,
    onSelectNone,
    onInvertSelection,
    selectedCount,
    totalCount,
    mode,
    className,
}: BulkActionsProps) {
    // Only show bulk actions in multi mode
    if (mode === 'single') return null;

    return (
        <div className={cn("flex items-center bg-muted/50 rounded-md p-0.5 border border-transparent hover:border-border/50 transition-colors", className)}>
            <div className="flex items-center">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-sm hover:bg-background hover:shadow-sm hover:text-primary transition-all"
                    onClick={onSelectAll}
                    disabled={selectedCount === totalCount}
                    title="Select All"
                >
                    <CheckSquare className="h-3.5 w-3.5" />
                </Button>
                <div className="w-[1px] h-3 bg-border/50 mx-0.5" />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-sm hover:bg-background hover:shadow-sm hover:text-primary transition-all"
                    onClick={onSelectNone}
                    disabled={selectedCount === 0}
                    title="Select None"
                >
                    <Square className="h-3.5 w-3.5" />
                </Button>
                <div className="w-[1px] h-3 bg-border/50 mx-0.5" />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-sm hover:bg-background hover:shadow-sm hover:text-primary transition-all"
                    onClick={onInvertSelection}
                    disabled={totalCount === 0}
                    title="Invert Selection"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
