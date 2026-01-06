// Tags Widget
// Multi-tag input with add/remove functionality

import { useState, KeyboardEvent } from 'react';
import { X, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { WidgetDefinition, WidgetProps } from '../lib/types';

/** Tags widget configuration */
interface TagsConfig {
    placeholder?: string;
    maxTags?: number;
}

function TagsComponent({ value, onChange, disabled, field }: WidgetProps) {
    const config = (field?.config || {}) as TagsConfig;
    const { placeholder = 'Add tag...', maxTags } = config;

    const [inputValue, setInputValue] = useState('');

    // Ensure value is always an array
    const tags: string[] = Array.isArray(value) ? value : [];

    const canAddMore = !maxTags || tags.length < maxTags;

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            addTag(inputValue.trim());
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            // Remove last tag on backspace when input is empty
            removeTag(tags.length - 1);
        }
    };

    const addTag = (tag: string) => {
        if (!tag || tags.includes(tag) || !canAddMore) return;
        onChange([...tags, tag]);
        setInputValue('');
    };

    const removeTag = (index: number) => {
        const newTags = tags.filter((_, i) => i !== index);
        onChange(newTags);
    };

    return (
        <div className={cn(
            "flex flex-wrap gap-1.5 p-2 rounded-md border bg-background/50",
            "focus-within:ring-1 focus-within:ring-ring",
            disabled && "opacity-50 cursor-not-allowed"
        )}>
            {/* Existing Tags */}
            {tags.map((tag, index) => (
                <Badge
                    key={`${tag}-${index}`}
                    variant="secondary"
                    className="gap-1 px-2 py-0.5 text-xs font-normal"
                >
                    {tag}
                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => removeTag(index)}
                            className="ml-0.5 hover:text-destructive transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </Badge>
            ))}

            {/* Input for new tags */}
            {canAddMore && !disabled && (
                <Input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        if (inputValue.trim()) {
                            addTag(inputValue.trim());
                        }
                    }}
                    placeholder={tags.length === 0 ? placeholder : ''}
                    className={cn(
                        "flex-1 min-w-[80px] h-6 px-1 text-xs",
                        "border-0 shadow-none focus-visible:ring-0",
                        "bg-transparent placeholder:text-muted-foreground/50"
                    )}
                />
            )}

            {/* Max tags indicator */}
            {maxTags && (
                <span className="text-[10px] text-muted-foreground/50 self-center ml-auto">
                    {tags.length}/{maxTags}
                </span>
            )}
        </div>
    );
}

export const TagsWidget: WidgetDefinition = {
    id: 'tags',
    render: (props) => <TagsComponent {...props} />,
    meta: {
        label: 'Tags',
        description: 'Multi-tag input',
        category: 'selection',
        outputType: 'array',
        icon: Tags,
    },
    configSchema: [
        { key: 'placeholder', type: 'string', label: 'Placeholder' },
        { key: 'maxTags', type: 'number', label: 'Max Tags' },
    ],
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};
