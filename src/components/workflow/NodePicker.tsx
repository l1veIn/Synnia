/**
 * NodePicker - Searchable node/recipe picker with path-based multi-level navigation
 * Supports arbitrary depth nesting based on recipe directory structure
 */

import { useMemo, useState } from 'react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { nodesConfig } from '@/components/workflow/nodes';
import { getRecipeTree, RecipeTreeNode } from '@/lib/recipes';
import { NodeType } from '@/types/project';
import {
    FileText,
    Box,
    Image as ImageIcon,
    Hash,
    Wand2,
    LucideIcon,
    ChevronRight,
    Home,
    Folder,
    FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Category icon mapping for base nodes
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
    action?: string;
}

export interface NodePickerProps {
    onSelect: (item: NodePickerItem) => void;
    onClose?: () => void;
    className?: string;
}

export function NodePicker({ onSelect, onClose, className }: NodePickerProps) {
    const [search, setSearch] = useState('');
    const [currentPath, setCurrentPath] = useState<string[]>([]);

    // Build base node items (always shown at top level)
    const baseNodeItems = useMemo(() => {
        const result: NodePickerItem[] = [];

        for (const [type, config] of Object.entries(nodesConfig)) {
            if (type.startsWith('recipe:')) continue;
            if (config.hidden && !config.fileImport) continue;

            if (config.fileImport) {
                result.push({
                    id: `action:import-${config.fileImport.assetType}`,
                    label: config.fileImport.label || config.title,
                    description: config.description || `Import ${config.fileImport.assetType} from file`,
                    category: config.category || 'Asset',
                    icon: typeof config.icon === 'function' ? config.icon : undefined,
                    action: 'import-file',
                    nodeType: type as NodeType,
                });
            } else {
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

        return result;
    }, []);

    // Get recipe tree
    const recipeTree = useMemo(() => getRecipeTree(), []);

    // Navigate to current path in tree
    const currentTreeNode = useMemo(() => {
        let node = recipeTree;
        for (const segment of currentPath) {
            const child = node.children?.find(
                (c) => c.type === 'folder' && c.name === segment
            );
            if (!child) return recipeTree; // Fallback to root
            node = child;
        }
        return node;
    }, [recipeTree, currentPath]);

    // All recipe items for search (flattened)
    const allRecipeItems = useMemo(() => {
        const items: NodePickerItem[] = [];

        function collectRecipes(node: RecipeTreeNode, pathPrefix: string[]) {
            if (node.type === 'recipe' && node.recipe) {
                items.push({
                    id: `recipe:${node.recipe.id}`,
                    label: node.recipe.name,
                    description: node.recipe.description,
                    category: pathPrefix.join('/'),
                    recipeId: node.recipe.id,
                    icon: node.recipe.icon,
                });
            }
            if (node.children) {
                for (const child of node.children) {
                    collectRecipes(child, child.type === 'folder' ? [...pathPrefix, child.name] : pathPrefix);
                }
            }
        }

        collectRecipes(recipeTree, []);
        return items;
    }, [recipeTree]);

    // Filter items when searching
    const filteredItems = useMemo(() => {
        if (!search) return null;

        const lower = search.toLowerCase();
        const filteredBase = baseNodeItems.filter(item =>
            item.label.toLowerCase().includes(lower) ||
            item.description?.toLowerCase().includes(lower)
        );
        const filteredRecipes = allRecipeItems.filter(item =>
            item.label.toLowerCase().includes(lower) ||
            item.description?.toLowerCase().includes(lower) ||
            item.category.toLowerCase().includes(lower)
        );

        return [...filteredBase, ...filteredRecipes];
    }, [search, baseNodeItems, allRecipeItems]);

    const handleSelect = (item: NodePickerItem) => {
        onSelect(item);
        onClose?.();
    };

    const handleFolderClick = (folderName: string) => {
        setCurrentPath([...currentPath, folderName]);
    };

    const handleNavigateUp = (targetIndex: number) => {
        setCurrentPath(currentPath.slice(0, targetIndex));
    };

    const isAtRoot = currentPath.length === 0;
    const isSearching = search.length > 0;

    // Count items in a folder (recursive)
    const countItems = (node: RecipeTreeNode): number => {
        if (node.type === 'recipe') return 1;
        return node.children?.reduce((acc, child) => acc + countItems(child), 0) || 0;
    };

    return (
        <Command className={cn("flex flex-col", className)}>
            <CommandInput
                placeholder="Search nodes and recipes..."
                value={search}
                onValueChange={(val) => {
                    setSearch(val);
                }}
            />

            {/* Breadcrumb Navigation */}
            {!isSearching && !isAtRoot && (
                <div className="flex items-center gap-0.5 px-2 py-1.5 border-b text-sm overflow-x-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => setCurrentPath([])}
                    >
                        <Home className="w-3.5 h-3.5" />
                    </Button>
                    {currentPath.map((segment, i) => (
                        <div key={i} className="flex items-center shrink-0">
                            <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs"
                                onClick={() => handleNavigateUp(i + 1)}
                            >
                                {segment}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <CommandList className="max-h-[320px]">
                <CommandEmpty>No nodes found.</CommandEmpty>

                {/* Search Results */}
                {isSearching && filteredItems && (
                    <CommandGroup heading="Search Results">
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
                                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                                        {item.category || 'Basic'}
                                    </span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}

                {/* Normal Navigation View */}
                {!isSearching && (
                    <>
                        {/* Base Nodes (only at root level) */}
                        {isAtRoot && (
                            <CommandGroup heading="Basic Nodes">
                                {baseNodeItems.map(item => {
                                    const ItemIcon = item.icon || categoryIcons[item.category] || Box;
                                    return (
                                        <CommandItem
                                            key={item.id}
                                            value={item.label}
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
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        )}

                        {isAtRoot && <CommandSeparator />}

                        {/* Recipe Folders and Items */}
                        <CommandGroup heading={isAtRoot ? "Recipes" : currentPath[currentPath.length - 1]}>
                            {currentTreeNode.children?.map(child => {
                                if (child.type === 'folder') {
                                    const itemCount = countItems(child);
                                    return (
                                        <CommandItem
                                            key={`folder:${child.name}`}
                                            value={child.name}
                                            onSelect={() => handleFolderClick(child.name)}
                                            className="flex items-center justify-between cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Folder className="w-4 h-4 text-muted-foreground group-hover:hidden" />
                                                <FolderOpen className="w-4 h-4 text-muted-foreground hidden group-hover:block" />
                                                <span className="font-medium">{child.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <span className="text-xs">{itemCount}</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </div>
                                        </CommandItem>
                                    );
                                } else if (child.recipe) {
                                    const ItemIcon = child.recipe.icon || Wand2;
                                    return (
                                        <CommandItem
                                            key={`recipe:${child.recipe.id}`}
                                            value={child.recipe.name}
                                            onSelect={() => handleSelect({
                                                id: `recipe:${child.recipe!.id}`,
                                                label: child.recipe!.name,
                                                description: child.recipe!.description,
                                                category: currentPath.join('/'),
                                                recipeId: child.recipe!.id,
                                                icon: child.recipe!.icon,
                                            })}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <ItemIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium truncate">{child.recipe.name}</span>
                                                {child.recipe.description && (
                                                    <span className="text-xs text-muted-foreground line-clamp-1">
                                                        {child.recipe.description}
                                                    </span>
                                                )}
                                            </div>
                                        </CommandItem>
                                    );
                                }
                                return null;
                            })}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </Command>
    );
}

export default NodePicker;
