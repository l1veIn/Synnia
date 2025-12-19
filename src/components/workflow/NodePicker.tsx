/**
 * NodePicker - Searchable node/recipe picker with multi-level category navigation
 * Used by toolbar and context menu for adding nodes to canvas
 */

import { useMemo, useState } from 'react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { nodesConfig } from '@/components/workflow/nodes';
import { getRecipesByCategory } from '@/lib/recipes';
import { NodeType } from '@/types/project';
import { FileText, Box, Image as ImageIcon, Hash, Wand2, LucideIcon, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Category icon mapping
const categoryIcons: Record<string, LucideIcon> = {
    'Basic': Box,
    'Agent': Wand2,
    'Media': ImageIcon,
    'LLM': FileText,
    'Text': FileText,
    'Math': Hash,
};

export interface NodePickerItem {
    id: string;
    label: string;
    description?: string;
    category: string;
    icon?: LucideIcon;
    recipeId?: string;
    nodeType?: NodeType;
    // Special action identifier (e.g., 'import-image')
    action?: string;
}

export interface NodePickerProps {
    onSelect: (item: NodePickerItem) => void;
    onClose?: () => void;
    className?: string;
}

export function NodePicker({ onSelect, onClose, className }: NodePickerProps) {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Build unified list of all pickable items
    const items = useMemo(() => {
        const result: NodePickerItem[] = [];

        // 1. Add base node types from nodesConfig
        for (const [type, config] of Object.entries(nodesConfig)) {
            // Skip recipe virtual types
            if (type.startsWith('recipe:')) continue;

            // Skip hidden nodes UNLESS they have fileImport (those are shown as import actions)
            if (config.hidden && !config.fileImport) continue;

            // If node has fileImport config, add as action item
            if (config.fileImport) {
                result.push({
                    id: `action:import-${config.fileImport.assetType}`,
                    label: config.fileImport.label || config.title,
                    description: config.description || `Import ${config.fileImport.assetType} from file`,
                    category: config.category || 'Asset',
                    icon: typeof config.icon === 'function' ? config.icon : undefined,
                    action: 'import-file',
                    // Store import config for handler
                    nodeType: type as NodeType,
                });
            } else {
                // Regular node
                result.push({
                    id: type,
                    label: config.title,
                    description: config.description,
                    category: config.category || 'Basic',
                    icon: typeof config.icon === 'function' ? config.icon : undefined,
                    nodeType: type as NodeType,
                });
            }
        }

        // 2. Add recipe nodes grouped by category
        const recipesByCategory = getRecipesByCategory();
        for (const [category, recipes] of Object.entries(recipesByCategory)) {
            for (const recipe of recipes) {
                result.push({
                    id: `recipe:${recipe.id}`,
                    label: recipe.name,
                    description: recipe.description,
                    category,
                    recipeId: recipe.id,
                });
            }
        }

        return result;
    }, []);

    // Get unique categories with counts
    const categories = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of items) {
            counts[item.category] = (counts[item.category] || 0) + 1;
        }

        // Sort: Basic first, then alphabetically
        return Object.entries(counts)
            .sort(([a], [b]) => {
                if (a === 'Basic') return -1;
                if (b === 'Basic') return 1;
                return a.localeCompare(b);
            })
            .map(([name, count]) => ({ name, count }));
    }, [items]);

    // Filter items by search and category
    const filteredItems = useMemo(() => {
        let filtered = items;

        // If searching, search across all categories
        if (search) {
            const lower = search.toLowerCase();
            filtered = items.filter(item =>
                item.label.toLowerCase().includes(lower) ||
                item.description?.toLowerCase().includes(lower) ||
                item.category.toLowerCase().includes(lower)
            );
        } else if (selectedCategory) {
            // If category selected, show only that category
            filtered = items.filter(item => item.category === selectedCategory);
        }

        return filtered;
    }, [items, search, selectedCategory]);

    const handleSelect = (item: NodePickerItem) => {
        onSelect(item);
        onClose?.();
    };

    // Show category list when no search and no category selected
    const showCategoryList = !search && !selectedCategory;

    return (
        <Command className={cn("flex flex-col", className)}>
            <CommandInput
                placeholder="Search nodes..."
                value={search}
                onValueChange={(val) => {
                    setSearch(val);
                    if (val) setSelectedCategory(null); // Reset category when searching
                }}
            />

            {/* Back button when viewing a category */}
            {selectedCategory && !search && (
                <div className="px-2 py-1 border-b">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedCategory(null)}
                    >
                        <ArrowLeft className="w-3 h-3 mr-1" />
                        All Categories
                    </Button>
                </div>
            )}

            <CommandList className="max-h-[280px]">
                <CommandEmpty>No nodes found.</CommandEmpty>

                {/* Category List View */}
                {showCategoryList && (
                    <CommandGroup heading="Categories">
                        {categories.map(({ name, count }) => {
                            const Icon = categoryIcons[name] || Box;
                            return (
                                <CommandItem
                                    key={name}
                                    value={name}
                                    onSelect={() => setSelectedCategory(name)}
                                    className="flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4 text-muted-foreground" />
                                        <span>{name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <span className="text-xs">{count}</span>
                                        <ChevronRight className="w-3 h-3" />
                                    </div>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}

                {/* Items List View */}
                {!showCategoryList && (
                    <CommandGroup heading={selectedCategory || 'Search Results'}>
                        {filteredItems.map(item => {
                            const ItemIcon = item.icon || categoryIcons[item.category] || Box;
                            return (
                                <CommandItem
                                    key={item.id}
                                    value={`${item.label} ${item.category} ${item.description || ''}`}
                                    onSelect={() => handleSelect(item)}
                                    className="flex items-center gap-2 cursor-pointer"
                                >
                                    <ItemIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium truncate">{item.label}</span>
                                        {item.description && (
                                            <span className="text-xs text-muted-foreground line-clamp-1">
                                                {item.description}
                                            </span>
                                        )}
                                    </div>
                                    {search && (
                                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                                            {item.category}
                                        </span>
                                    )}
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}
            </CommandList>
        </Command>
    );
}

export default NodePicker;
