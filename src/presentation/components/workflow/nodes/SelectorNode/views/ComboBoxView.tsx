import { memo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/presentation/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/presentation/components/ui/popover';
import { SelectionIndicator } from './SelectionIndicator';
import { HighlightedText } from './HighlightedText';
import type { ViewProps, SelectorOption } from '../types';

/**
 * ComboBoxView - Robust dropdown with search using Popover/Command
 */
export const ComboBoxView = memo(function ComboBoxView({
    options,
    selected,
    onSelect,
    mode,
    schema,
    fieldMapping,
    isDisabled,
}: ViewProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter options using command's logic or pre-filter? 
    // Command component usually filters its children, but for large lists we might want custom filtering.
    // However, for consistency and performance with Command, we can let Command handle it OR filter ourselves.
    // Given the previous implementation did custom filtering, let's keep custom filtering logic 
    // but pass it to Command loop, or just map all and let Command filter if it supports custom keys.
    // Actually, Command does fuzzy search on `value`.

    // Custom filter logic
    const filteredOptions = options.filter(opt => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        // Search in all string fields
        for (const field of schema) {
            const val = opt[field.key];
            if (typeof val === 'string' && val.toLowerCase().includes(query)) {
                return true;
            }
        }
        return opt.id.toLowerCase().includes(query);
    });

    const getDisplayValue = (option: SelectorOption): string => {
        const value = option[fieldMapping.title];
        if (value === undefined || value === null) return option.id;
        return String(value);
    };

    const selectedOptions = options.filter(opt => selected.includes(opt.id));

    const handleSelectOption = (optionId: string) => {
        onSelect(optionId);
        if (mode === 'single') {
            setOpen(false);
        }
    };

    // Remove selected item (for multi mode tags)
    const removeSelected = (optionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(optionId);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        'w-full justify-between h-auto min-h-[36px] px-3 py-2',
                        isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setOpen(!open)}
                >
                    <div className="flex flex-wrap gap-1.5 flex-1 text-left items-center">
                        {selectedOptions.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Select options...</span>
                        ) : mode === 'multi' ? (
                            selectedOptions.map(opt => (
                                <Badge
                                    key={opt.id}
                                    variant="secondary"
                                    className="text-xs h-5 gap-1 pr-1 font-normal"
                                >
                                    {getDisplayValue(opt)}
                                    <div
                                        role="button"
                                        className="rounded-full hover:bg-muted p-0.5 transition-colors"
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent popover toggle
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => removeSelected(opt.id, e)}
                                    >
                                        <X className="h-3 w-3" />
                                    </div>
                                </Badge>
                            ))
                        ) : (
                            <span className="text-sm font-medium">{getDisplayValue(selectedOptions[0])}</span>
                        )}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 min-w-[300px]" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        className="h-9"
                    />
                    <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map(option => {
                                    const isSelected = selected.includes(option.id);
                                    return (
                                        <CommandItem
                                            key={option.id}
                                            value={option.id}
                                            onSelect={() => handleSelectOption(option.id)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 w-full">
                                                <SelectionIndicator
                                                    mode={mode}
                                                    isSelected={isSelected}
                                                />
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="truncate text-sm font-medium">
                                                        <HighlightedText text={getDisplayValue(option)} query={searchQuery} />
                                                    </span>
                                                    {fieldMapping.subtitle && option[fieldMapping.subtitle] && (
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            <HighlightedText text={String(option[fieldMapping.subtitle])} query={searchQuery} />
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Checkmark for single mode fallback visual if needed, though indicator handles it */}
                                            </div>
                                        </CommandItem>
                                    );
                                })
                            ) : null}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
});
