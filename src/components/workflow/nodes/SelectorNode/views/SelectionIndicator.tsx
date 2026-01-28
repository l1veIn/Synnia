import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectionIndicatorProps {
    mode: 'single' | 'multi';
    isSelected: boolean;
    className?: string;
    size?: 'sm' | 'md';
}

/**
 * SelectionIndicator - Unified checkbox/radio UI for selection
 */
export function SelectionIndicator({ mode, isSelected, className, size = 'sm' }: SelectionIndicatorProps) {
    const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const iconClasses = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

    if (mode === 'multi') {
        return (
            <div
                className={cn(
                    sizeClasses,
                    'rounded-md border flex items-center justify-center transition-all duration-200',
                    isSelected
                        ? 'bg-primary border-primary shadow-sm scale-100'
                        : 'border-muted-foreground/30 bg-muted/20 hover:border-primary/50',
                    className
                )}
            >
                <Check
                    className={cn(
                        iconClasses,
                        'text-primary-foreground transition-all duration-200',
                        isSelected ? 'opacity-100 scale-100 stroke-[3px]' : 'opacity-0 scale-50'
                    )}
                />
            </div>
        );
    }

    // Single mode - radio button style
    return (
        <div
            className={cn(
                sizeClasses,
                'rounded-full border flex items-center justify-center transition-all duration-200',
                isSelected
                    ? 'border-primary ring-offset-2 ring-1 ring-primary/20'
                    : 'border-muted-foreground/30 bg-muted/20 hover:border-primary/50',
                className
            )}
        >
            <div
                className={cn(
                    'rounded-full bg-primary transition-all duration-200',
                    isSelected ? 'w-2 h-2 opacity-100 scale-100' : 'w-0 h-0 opacity-0 scale-0'
                )}
            />
        </div>
    );
}
