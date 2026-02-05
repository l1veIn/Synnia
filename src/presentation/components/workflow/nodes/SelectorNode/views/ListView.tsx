import { memo, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewProps, SelectorOption } from '../types';
import { SelectionIndicator } from './SelectionIndicator';
import { HighlightedText } from './HighlightedText';

/**
 * ListView - Default list view with expandable details
 */
export const ListView = memo(function ListView({
    options,
    selected,
    onSelect,
    mode,
    schema,
    fieldMapping,
    searchQuery,
    isDisabled,
}: ViewProps) {
    const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

    // Toggle option expansion
    const toggleExpand = useCallback((optionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedOptions(prev => {
            const next = new Set(prev);
            if (next.has(optionId)) {
                next.delete(optionId);
            } else {
                next.add(optionId);
            }
            return next;
        });
    }, []);

    // Get display value for an option
    const getDisplayValue = (option: SelectorOption, key: string): string => {
        const value = option[key];
        if (value === undefined || value === null) return '';
        return String(value);
    };

    // Check if option has extra data to show (more than just title)
    const hasExtraData = schema.length > 1;

    if (options.length === 0) {
        return (
            <div className="text-xs text-muted-foreground text-center py-4">
                No options available
            </div>
        );
    }

    return (
        <div className="space-y-px">
            {options.map(option => {
                const isSelected = selected.includes(option.id);
                const isExpanded = expandedOptions.has(option.id);
                const titleValue = getDisplayValue(option, fieldMapping.title);

                return (
                    <div
                        key={option.id}
                        className={cn(
                            "group border rounded-md transition-all duration-200 overflow-hidden",
                            isSelected
                                ? "bg-primary/5 border-primary/20"
                                : "bg-card border-transparent hover:border-border/50 hover:bg-muted/30"
                        )}
                    >
                        {/* Option row */}
                        <div
                            className={cn(
                                'flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none',
                                isDisabled && 'opacity-50 cursor-not-allowed'
                            )}
                            onClick={() => !isDisabled && onSelect(option.id)}
                        >
                            <SelectionIndicator mode={mode} isSelected={isSelected} />

                            <span className={cn(
                                "text-xs flex-1 truncate transition-colors",
                                isSelected ? "text-primary font-medium" : "text-foreground group-hover:text-foreground"
                            )}>
                                <HighlightedText text={titleValue} query={searchQuery} />
                            </span>

                            {/* Expand button when there's extra data */}
                            {hasExtraData && (
                                <button
                                    className="p-0.5 hover:bg-muted rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => toggleExpand(option.id, e)}
                                    title="Show details"
                                >
                                    <ChevronDown
                                        className={cn(
                                            'h-3.5 w-3.5 transition-transform duration-200',
                                            isExpanded && 'rotate-180'
                                        )}
                                    />
                                </button>
                            )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && hasExtraData && (
                            <div className="px-3 pb-2 pt-0.5 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                {schema
                                    .filter(field => field.key !== fieldMapping.title)
                                    .map(field => {
                                        const val = option[field.key];
                                        if (val === undefined || val === null || val === '') return null;

                                        return (
                                            <div key={field.key} className="flex items-start gap-2 text-[10px]">
                                                <span className="text-muted-foreground/70 shrink-0 min-w-[3rem]">
                                                    {field.label || field.key}:
                                                </span>
                                                {field.widget === 'color' ? (
                                                    <div className="flex items-center gap-1">
                                                        <div
                                                            className="h-3 w-3 rounded border"
                                                            style={{ backgroundColor: String(val) }}
                                                        />
                                                        <span className="font-mono text-muted-foreground">{String(val)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="truncate text-muted-foreground">
                                                        <HighlightedText text={String(val)} query={searchQuery} />
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});
