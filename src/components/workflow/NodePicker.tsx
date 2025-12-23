/**
 * NodePicker - Searchable node/recipe picker with path-based multi-level navigation
 * Supports arbitrary depth nesting based on recipe directory structure
 * Features: Recent nodes cache, hierarchical base nodes
 */

import { useCallback, useMemo, useState } from 'react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { nodeRegistry } from '@core/registry/NodeRegistry';
import { getRecipeTree, RecipeTreeNode } from '@features/recipes';
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
    Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUIPreferencesStore } from '@/store/uiPreferencesStore';

// Category icon mapping for base nodes
const categoryIcons: Record<string, LucideIcon> = {
    'Basic': Box,
    'Agent': Wand2,
    'Media': ImageIcon,
    'LLM': FileText,
    'Text': FileText,
    'Math': Hash,
};

// Virtual folder name for base nodes
const BASE_NODES_FOLDER = 'Basic Nodes';

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

    // UI Preferences store for recent nodes
    const recentNodeIds = useUIPreferencesStore((s) => s.recentNodeIds);
    const addRecentNode = useUIPreferencesStore((s) => s.addRecentNode);

    // Build base node items
    const baseNodeItems = useMemo(() => {
        const result: NodePickerItem[] = [];
        const allMetas = nodeRegistry.getAllMetas();

        for (const [type, meta] of Object.entries(allMetas)) {
            if (type.startsWith('recipe:')) continue;
            if (meta.hidden && !meta.fileImport) continue;

            if (meta.fileImport) {
                result.push({
                    id: `action:import-${meta.fileImport.assetType}`,
                    label: meta.fileImport.label || meta.title,
                    description: meta.description || `Import ${meta.fileImport.assetType} from file`,
                    category: meta.category || 'Asset',
                    icon: meta.icon,
                    action: 'import-file',
                    nodeType: type as NodeType,
                });
            } else {
                result.push({
                    id: type,
                    label: meta.title,
                    description: meta.description,
                    category: meta.category || 'Basic',
                    icon: meta.icon,
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

    // All node items (base + recipes) for recent lookup
    const allNodeItems = useMemo(() => {
        return [...baseNodeItems, ...allRecipeItems];
    }, [baseNodeItems, allRecipeItems]);

    // Recent nodes (resolved from cache)
    const recentNodeItems = useMemo(() => {
        return recentNodeIds
            .map((id: string) => allNodeItems.find((item: NodePickerItem) => item.id === id))
            .filter((item): item is NodePickerItem => item !== undefined);
    }, [allNodeItems, recentNodeIds]);

    const handleSelect = useCallback((item: NodePickerItem) => {
        // Record to recent nodes cache
        addRecentNode(item.id);
        onSelect(item);
        onClose?.();
    }, [onSelect, onClose]);

    const handleFolderClick = (folderName: string) => {
        setCurrentPath([...currentPath, folderName]);
    };

    const handleNavigateUp = (targetIndex: number) => {
        setCurrentPath(currentPath.slice(0, targetIndex));
    };

    const isAtRoot = currentPath.length === 0;
    const isInBaseNodes = currentPath.length === 1 && currentPath[0] === BASE_NODES_FOLDER;
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
                        {/* Recent Nodes (only at root level, when there are recent items) */}
                        {isAtRoot && recentNodeItems.length > 0 && (
                            <>
                                <CommandGroup heading="Recent">
                                    {recentNodeItems.map(item => {
                                        const ItemIcon = item.icon || categoryIcons[item.category] || Box;
                                        return (
                                            <CommandItem
                                                key={`recent:${item.id}`}
                                                value={`recent ${item.label}`}
                                                onSelect={() => handleSelect(item)}
                                                className="flex items-center gap-2 cursor-pointer"
                                            >
                                                <Clock className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                                                <ItemIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                <span className="font-medium truncate">{item.label}</span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        )}

                        {/* Folder navigation at root level */}
                        {isAtRoot && (
                            <CommandGroup heading="Categories">
                                {/* Basic Nodes Folder */}
                                <CommandItem
                                    value={BASE_NODES_FOLDER}
                                    onSelect={() => handleFolderClick(BASE_NODES_FOLDER)}
                                    className="flex items-center justify-between cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2">
                                        <Folder className="w-4 h-4 text-muted-foreground group-hover:hidden" />
                                        <FolderOpen className="w-4 h-4 text-muted-foreground hidden group-hover:block" />
                                        <span className="font-medium">{BASE_NODES_FOLDER}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <span className="text-xs">{baseNodeItems.length}</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </div>
                                </CommandItem>

                                {/* Recipe Folders */}
                                {currentTreeNode.children?.filter(c => c.type === 'folder').map(child => {
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
                                })}
                            </CommandGroup>
                        )}

                        {/* Base Nodes Content (inside Basic Nodes folder) */}
                        {isInBaseNodes && (
                            <CommandGroup heading={BASE_NODES_FOLDER}>
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

                        {/* Recipe Folders and Items (when navigating inside recipe folders) */}
                        {!isAtRoot && !isInBaseNodes && (
                            <CommandGroup heading={currentPath[currentPath.length - 1]}>
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
                        )}
                    </>
                )}
            </CommandList>
        </Command>
    );
}

export default NodePicker;
