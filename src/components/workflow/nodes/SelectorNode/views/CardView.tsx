import { memo } from 'react';
import { cn } from '@/lib/utils';
import { SynniaImage } from '@/components/ui/synnia-image';
import type { CardViewProps, SelectorOption } from '../types';
import { SelectionIndicator } from './SelectionIndicator';
import { HighlightedText } from './HighlightedText';

/**
 * CardView - Grid layout with cards showing avatar, title, subtitle
 */
export const CardView = memo(function CardView({
    options,
    selected,
    onSelect,
    mode,
    schema,
    fieldMapping,
    searchQuery,
    isDisabled,
    cardLayout,
}: CardViewProps) {
    // Get display values
    const getDisplayValue = (option: SelectorOption, key: string | undefined): string => {
        if (!key) return '';
        const value = option[key];
        if (value === undefined || value === null) return '';
        return String(value);
    };

    // Grid column classes
    const columnClasses: Record<number, string> = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
        6: 'grid-cols-6',
    };

    if (options.length === 0) {
        return (
            <div className="text-xs text-muted-foreground text-center py-4">
                No options available
            </div>
        );
    }

    return (
        <div className={cn('grid gap-2', columnClasses[cardLayout.columns] || 'grid-cols-3')}>
            {options.map(option => {
                const isSelected = selected.includes(option.id);
                const titleValue = getDisplayValue(option, fieldMapping.title);
                const subtitleValue = cardLayout.showSubtitle
                    ? getDisplayValue(option, fieldMapping.subtitle)
                    : '';
                const avatarValue = getDisplayValue(option, fieldMapping.avatar);
                const isHorizontal = cardLayout.orientation === 'horizontal';

                return (
                    <div
                        key={option.id}
                        className={cn(
                            'group relative border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 select-none bg-card',
                            'hover:shadow-md hover:border-primary/30',
                            isSelected
                                ? 'border-primary shadow-sm ring-1 ring-primary/20 bg-primary/5'
                                : 'border-border/60 hover:bg-muted/10',
                            isDisabled && 'opacity-50 cursor-not-allowed hover:shadow-none hover:border-border/60',
                            // Horizontal layout constraints
                            isHorizontal && 'flex items-center gap-2 p-2',
                        )}
                        onClick={() => !isDisabled && onSelect(option.id)}
                    >
                        {/* Avatar / Image */}
                        {cardLayout.showAvatar && (
                            isHorizontal ? (
                                // Horizontal Mode Avatar (Fixed small square)
                                <div className="shrink-0 h-10 w-10 relative">
                                    <SynniaImage
                                        src={avatarValue || undefined}
                                        fallbackText={titleValue}
                                        fallbackType={avatarValue ? 'initials' : 'sticker'}
                                        className="w-full h-full rounded-md group-hover:scale-105 transition-transform duration-200"
                                        shape="square"
                                    />
                                    <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-black/5" />
                                </div>
                            ) : (
                                // Vertical Mode Avatar (Fixed Aspect / Container)
                                // Using aspect-square (1:1) for consistent grid layout
                                <div className="w-full aspect-square bg-muted/30 relative overflow-hidden">
                                    <SynniaImage
                                        src={avatarValue || undefined}
                                        fallbackText={titleValue}
                                        fallbackType={avatarValue ? 'initials' : 'sticker'}
                                        className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                                        shape="square"
                                        size="full"
                                    />
                                    {/* Overlay for depth */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                                </div>
                            )
                        )}

                        {/* Text Content */}
                        <div className={cn(
                            "flex-1 min-w-0",
                            !isHorizontal && "p-2", // Padding for vertical layout
                            !isHorizontal && !cardLayout.showAvatar && "pt-6" // Extra top padding if no avatar in vertical
                        )}>
                            <div className={cn(
                                "text-xs font-medium truncate text-foreground/90 group-hover:text-primary transition-colors",
                                isHorizontal && "text-sm"
                            )}>
                                <HighlightedText text={titleValue} query={searchQuery} />
                            </div>
                            {subtitleValue && (
                                <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    <HighlightedText text={subtitleValue} query={searchQuery} />
                                </div>
                            )}
                        </div>

                        {/* Selection Indicator */}
                        {isHorizontal ? (
                            <div className="shrink-0 mr-1">
                                <SelectionIndicator mode={mode} isSelected={isSelected} size="sm" />
                            </div>
                        ) : (
                            <div className="absolute top-1.5 right-1.5 z-10">
                                <SelectionIndicator
                                    mode={mode}
                                    isSelected={isSelected}
                                    className={cn(
                                        "shadow-sm transition-opacity duration-200",
                                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
                                    )}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});
