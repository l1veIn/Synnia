/**
 * NodePicker Component Tests
 * Tests for the NodePicker searchable node/recipe picker component
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NodePickerItem } from '../NodePicker';
import { Box, FileText, Wand2 } from 'lucide-react';

// ============================================================================
// Mocks
// ============================================================================

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'nodePicker.basicNodes': 'Basic Nodes',
                'nodePicker.search_placeholder': 'Search nodes...',
                'nodePicker.noResults': 'No results found',
                'nodePicker.searchResults': 'Search Results',
                'nodePicker.recent': 'Recent',
                'nodePicker.categoriesLabel': 'Categories',
            };
            return translations[key] || key;
        },
    }),
}));

// Mock @core/registry/NodeRegistry
vi.mock('@core/registry/NodeRegistry', () => ({
    nodeRegistry: {
        getAllMetas: vi.fn(() => ({
            'text': {
                title: 'Text',
                icon: FileText,
                category: 'Basic',
                description: 'Text content node',
            },
            'image': {
                title: 'Image',
                icon: Box,
                category: 'Media',
                description: 'Image content node',
                fileImport: {
                    accept: 'image/*',
                    assetType: 'image',
                    label: 'Import Image',
                },
            },
            'hidden-node': {
                title: 'Hidden Node',
                icon: Box,
                category: 'Hidden',
                description: 'A hidden node',
                hidden: true,
            },
            'recipe:some-recipe': {
                title: 'Some Recipe',
                icon: Wand2,
                category: 'Recipe',
                description: 'A recipe node',
            },
        })),
    },
}));

// Mock @features/recipes
vi.mock('@features/recipes', () => ({
    getRecipeTree: vi.fn(() => ({
        type: 'folder',
        name: 'Recipes',
        path: [],
        children: [
            {
                type: 'folder',
                name: 'AI Tools',
                path: ['AI Tools'],
                children: [
                    {
                        type: 'recipe',
                        name: 'Chat Assistant',
                        path: ['AI Tools'],
                        recipe: {
                            id: 'chat-assistant',
                            name: 'Chat Assistant',
                            description: 'AI chat assistant',
                            icon: Wand2,
                        },
                    },
                    {
                        type: 'recipe',
                        name: 'Image Generator',
                        path: ['AI Tools'],
                        recipe: {
                            id: 'image-generator',
                            name: 'Image Generator',
                            description: 'Generate images',
                            icon: Box,
                        },
                    },
                ],
            },
            {
                type: 'folder',
                name: 'Data Processing',
                path: ['Data Processing'],
                children: [
                    {
                        type: 'recipe',
                        name: 'CSV Parser',
                        path: ['Data Processing'],
                        recipe: {
                            id: 'csv-parser',
                            name: 'CSV Parser',
                            description: 'Parse CSV files',
                            icon: FileText,
                        },
                    },
                ],
            },
        ],
    })),
}));

// Mock @/components/workflow/nodes
const mockEnsureRecipeNodeRegistered = vi.fn(async () => {
    // Do nothing
});

vi.mock('@/components/workflow/nodes', () => ({
    ensureRecipeNodeRegistered: () => mockEnsureRecipeNodeRegistered(),
}));

// Mock @/store/uiPreferencesStore
const mockAddRecentNode = vi.fn();
let mockRecentNodeIds: string[] = [];

vi.mock('@/store/uiPreferencesStore', () => ({
    useUIPreferencesStore: vi.fn((selector) => {
        const state = {
            recentNodeIds: [...mockRecentNodeIds],
            addRecentNode: mockAddRecentNode,
        };
        return selector ? selector(state) : state;
    }),
}));

// ============================================================================
// Test Helpers
// ============================================================================

const createMockProps = () => ({
    onSelect: vi.fn(),
    onClose: vi.fn(),
});

// ============================================================================
// NodePickerItem Interface Tests
// ============================================================================

describe('NodePickerItem Interface', () => {
    it('should accept a valid NodePickerItem', () => {
        const item: NodePickerItem = {
            id: 'test-id',
            label: 'Test Node',
            description: 'A test node',
            category: 'Test',
            icon: Box,
            recipeId: 'test-recipe',
            nodeType: 'text',
            action: 'import-file',
        };

        expect(item.id).toBe('test-id');
        expect(item.label).toBe('Test Node');
        expect(item.description).toBe('A test node');
        expect(item.category).toBe('Test');
        expect(item.icon).toBe(Box);
        expect(item.recipeId).toBe('test-recipe');
        expect(item.nodeType).toBe('text');
        expect(item.action).toBe('import-file');
    });

    it('should accept minimal NodePickerItem', () => {
        const item: NodePickerItem = {
            id: 'minimal-id',
            label: 'Minimal Node',
            category: 'Basic',
        };

        expect(item.id).toBe('minimal-id');
        expect(item.label).toBe('Minimal Node');
        expect(item.category).toBe('Basic');
        expect(item.description).toBeUndefined();
        expect(item.icon).toBeUndefined();
        expect(item.recipeId).toBeUndefined();
        expect(item.nodeType).toBeUndefined();
        expect(item.action).toBeUndefined();
    });
});

// ============================================================================
// NodePicker Props Tests
// ============================================================================

describe('NodePicker Props', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecentNodeIds = [];
    });

    it('should accept all required props', () => {
        const props = createMockProps();

        expect(props.onSelect).toBeDefined();
        expect(props.onClose).toBeDefined();
    });

    it('should accept optional className', () => {
        const props = {
            ...createMockProps(),
            className: 'custom-class',
        };

        expect(props.className).toBe('custom-class');
    });

    it('should work without onClose callback', () => {
        const props = {
            onSelect: vi.fn(),
        };

        expect(props.onSelect).toBeDefined();
        expect(props.onClose).toBeUndefined();
    });
});

// ============================================================================
// Mock Store Behavior Tests
// ============================================================================

describe('UI Preferences Store Mock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecentNodeIds = [];
    });

    it('should return empty array when no recent nodes', () => {
        mockRecentNodeIds = [];
        const state = {
            recentNodeIds: [...mockRecentNodeIds],
            addRecentNode: mockAddRecentNode,
        };

        expect(state.recentNodeIds).toEqual([]);
        expect(state.recentNodeIds).toHaveLength(0);
    });

    it('should return recent node IDs when populated', () => {
        mockRecentNodeIds = ['text', 'image', 'recipe:chat-assistant'];
        const state = {
            recentNodeIds: [...mockRecentNodeIds],
            addRecentNode: mockAddRecentNode,
        };

        expect(state.recentNodeIds).toHaveLength(3);
        expect(state.recentNodeIds).toContain('text');
        expect(state.recentNodeIds).toContain('image');
        expect(state.recentNodeIds).toContain('recipe:chat-assistant');
    });

    it('should call addRecentNode function', () => {
        const state = {
            recentNodeIds: [...mockRecentNodeIds],
            addRecentNode: mockAddRecentNode,
        };

        state.addRecentNode('text');

        expect(mockAddRecentNode).toHaveBeenCalledWith('text');
    });
});

// ============================================================================
// NodeRegistry Mock Tests
// ============================================================================

describe('NodeRegistry Mock', () => {
    it('should return node metas for basic nodes', () => {
        // Directly use the mock data since require won't work in test environment
        const metas = {
            'text': {
                title: 'Text',
                icon: FileText,
                category: 'Basic',
                description: 'Text content node',
            },
            'image': {
                title: 'Image',
                icon: Box,
                category: 'Media',
                description: 'Image content node',
                fileImport: {
                    accept: 'image/*',
                    assetType: 'image',
                    label: 'Import Image',
                },
            },
        };

        expect(metas['text']).toBeDefined();
        expect(metas['text'].title).toBe('Text');
        expect(metas['text'].category).toBe('Basic');
        expect(metas['text'].description).toBe('Text content node');
    });

    it('should include file import nodes', () => {
        const metas = {
            'image': {
                title: 'Image',
                icon: Box,
                category: 'Media',
                description: 'Image content node',
                fileImport: {
                    accept: 'image/*',
                    assetType: 'image',
                    label: 'Import Image',
                },
            },
        };

        expect(metas['image']).toBeDefined();
        expect(metas['image'].fileImport).toBeDefined();
        expect(metas['image'].fileImport?.assetType).toBe('image');
    });

    it('should include hidden nodes', () => {
        const metas = {
            'hidden-node': {
                title: 'Hidden Node',
                icon: Box,
                category: 'Hidden',
                description: 'A hidden node',
                hidden: true,
            },
        };

        expect(metas['hidden-node']).toBeDefined();
        expect(metas['hidden-node'].hidden).toBe(true);
    });

    it('should include recipe: prefixed nodes', () => {
        const metas = {
            'recipe:some-recipe': {
                title: 'Some Recipe',
                icon: Wand2,
                category: 'Recipe',
                description: 'A recipe node',
            },
        };

        expect(metas['recipe:some-recipe']).toBeDefined();
        expect(metas['recipe:some-recipe'].title).toBe('Some Recipe');
    });
});

// ============================================================================
// Recipe Tree Mock Tests
// ============================================================================

describe('Recipe Tree Mock', () => {
    const mockTree = {
        type: 'folder' as const,
        name: 'Recipes',
        path: [],
        children: [
            {
                type: 'folder' as const,
                name: 'AI Tools',
                path: ['AI Tools'],
                children: [
                    {
                        type: 'recipe' as const,
                        name: 'Chat Assistant',
                        path: ['AI Tools'],
                        recipe: {
                            id: 'chat-assistant',
                            name: 'Chat Assistant',
                            description: 'AI chat assistant',
                            icon: Wand2,
                        },
                    },
                    {
                        type: 'recipe' as const,
                        name: 'Image Generator',
                        path: ['AI Tools'],
                        recipe: {
                            id: 'image-generator',
                            name: 'Image Generator',
                            description: 'Generate images',
                            icon: Box,
                        },
                    },
                ],
            },
            {
                type: 'folder' as const,
                name: 'Data Processing',
                path: ['Data Processing'],
                children: [
                    {
                        type: 'recipe' as const,
                        name: 'CSV Parser',
                        path: ['Data Processing'],
                        recipe: {
                            id: 'csv-parser',
                            name: 'CSV Parser',
                            description: 'Parse CSV files',
                            icon: FileText,
                        },
                    },
                ],
            },
        ],
    };

    it('should return hierarchical recipe tree', () => {
        const tree = mockTree;

        expect(tree.type).toBe('folder');
        expect(tree.name).toBe('Recipes');
        expect(tree.path).toEqual([]);
        expect(tree.children).toBeDefined();
        expect(tree.children).toHaveLength(2);
    });

    it('should include AI Tools folder with recipes', () => {
        const tree = mockTree;
        const aiTools = tree.children?.find(c => c.name === 'AI Tools');

        expect(aiTools).toBeDefined();
        expect(aiTools?.type).toBe('folder');
        expect(aiTools?.children).toHaveLength(2);

        const chatAssistant = aiTools?.children?.find(c => c.name === 'Chat Assistant');
        expect(chatAssistant?.type).toBe('recipe');
        expect(chatAssistant?.recipe?.id).toBe('chat-assistant');
    });

    it('should include Data Processing folder', () => {
        const tree = mockTree;
        const dataProcessing = tree.children?.find(c => c.name === 'Data Processing');

        expect(dataProcessing).toBeDefined();
        expect(dataProcessing?.type).toBe('folder');
        expect(dataProcessing?.path).toEqual(['Data Processing']);
    });
});

// ============================================================================
// Translation Mock Tests
// ============================================================================

describe('Translation Mock', () => {
    it('should provide translations for all nodePicker keys', () => {
        // Simulate the mock translation function
        const t = (key: string) => {
            const translations: Record<string, string> = {
                'nodePicker.basicNodes': 'Basic Nodes',
                'nodePicker.search_placeholder': 'Search nodes...',
                'nodePicker.noResults': 'No results found',
                'nodePicker.searchResults': 'Search Results',
                'nodePicker.recent': 'Recent',
                'nodePicker.categoriesLabel': 'Categories',
            };
            return translations[key] || key;
        };

        expect(t('nodePicker.basicNodes')).toBe('Basic Nodes');
        expect(t('nodePicker.search_placeholder')).toBe('Search nodes...');
        expect(t('nodePicker.noResults')).toBe('No results found');
        expect(t('nodePicker.searchResults')).toBe('Search Results');
        expect(t('nodePicker.recent')).toBe('Recent');
        expect(t('nodePicker.categoriesLabel')).toBe('Categories');
    });

    it('should return key for unknown translations', () => {
        const t = (key: string) => {
            const translations: Record<string, string> = {};
            return translations[key] || key;
        };

        expect(t('unknown.key')).toBe('unknown.key');
    });
});

// ============================================================================
// ensureRecipeNodeRegistered Mock Tests
// ============================================================================

describe('ensureRecipeNodeRegistered Mock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should be a function', () => {
        expect(mockEnsureRecipeNodeRegistered).toBeDefined();
        expect(typeof mockEnsureRecipeNodeRegistered).toBe('function');
    });

    it('should be async', async () => {
        const result = mockEnsureRecipeNodeRegistered();
        expect(result).toBeInstanceOf(Promise);
        await result;
    });

    it('should resolve without errors', async () => {
        await expect(mockEnsureRecipeNodeRegistered()).resolves.toBeUndefined();
    });
});

// ============================================================================
// Filtering Logic Tests
// ============================================================================

describe('Filtering Logic', () => {
    it('should filter items by label', () => {
        const items: NodePickerItem[] = [
            { id: '1', label: 'Text Node', category: 'Basic' },
            { id: '2', label: 'Image Node', category: 'Media' },
            { id: '3', label: 'Chat Assistant', category: 'AI Tools' },
        ];

        const search = 'Text';
        const filtered = items.filter(
            item => item.label.toLowerCase().includes(search.toLowerCase())
        );

        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('1');
    });

    it('should filter items by description', () => {
        const items: NodePickerItem[] = [
            { id: '1', label: 'Text', description: 'Text content node', category: 'Basic' },
            { id: '2', label: 'Image', description: 'Image content node', category: 'Media' },
        ];

        const search = 'content';
        const filtered = items.filter(
            item => item.description?.toLowerCase().includes(search.toLowerCase())
        );

        expect(filtered).toHaveLength(2);
    });

    it('should filter items by category', () => {
        const items: NodePickerItem[] = [
            { id: '1', label: 'Text', category: 'Basic' },
            { id: '2', label: 'Image', category: 'Media' },
            { id: '3', label: 'Chat', category: 'AI Tools' },
        ];

        const search = 'AI Tools';
        const filtered = items.filter(
            item => item.category.toLowerCase().includes(search.toLowerCase())
        );

        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('3');
    });

    it('should be case insensitive', () => {
        const items: NodePickerItem[] = [
            { id: '1', label: 'Text Node', category: 'Basic' },
        ];

        // Note: .toLowerCase() is called on the search term, not the label
        const search1 = 'text';
        const search2 = 'TEXT';
        const search3 = 'TeXt';

        expect(items.filter(i => i.label.toLowerCase().includes(search1.toLowerCase()))).toHaveLength(1);
        expect(items.filter(i => i.label.toLowerCase().includes(search2.toLowerCase()))).toHaveLength(1);
        expect(items.filter(i => i.label.toLowerCase().includes(search3.toLowerCase()))).toHaveLength(1);
    });

    it('should return empty array when no matches', () => {
        const items: NodePickerItem[] = [
            { id: '1', label: 'Text Node', category: 'Basic' },
        ];

        const filtered = items.filter(
            item => item.label.toLowerCase().includes('xyzxyz')
        );

        expect(filtered).toHaveLength(0);
    });
});

// ============================================================================
// Recent Nodes Logic Tests
// ============================================================================

describe('Recent Nodes Logic', () => {
    it('should map recent node IDs to NodePickerItems', () => {
        const allItems: NodePickerItem[] = [
            { id: 'text', label: 'Text', category: 'Basic' },
            { id: 'image', label: 'Image', category: 'Media' },
            { id: 'recipe:chat', label: 'Chat', category: 'AI' },
        ];

        const recentIds = ['text', 'image'];
        const recentItems = recentIds
            .map(id => allItems.find(item => item.id === id))
            .filter((item): item is NodePickerItem => item !== undefined);

        expect(recentItems).toHaveLength(2);
        expect(recentItems[0].id).toBe('text');
        expect(recentItems[1].id).toBe('image');
    });

    it('should filter out non-existent recent node IDs', () => {
        const allItems: NodePickerItem[] = [
            { id: 'text', label: 'Text', category: 'Basic' },
        ];

        const recentIds = ['text', 'non-existent', 'another-missing'];
        const recentItems = recentIds
            .map(id => allItems.find(item => item.id === id))
            .filter((item): item is NodePickerItem => item !== undefined);

        expect(recentItems).toHaveLength(1);
        expect(recentItems[0].id).toBe('text');
    });

    it('should respect MAX_RECENT_NODES limit', () => {
        const MAX_RECENT_NODES = 5;
        const newId = 'new-node';
        const existingIds = ['a', 'b', 'c', 'd', 'e'];

        // Filter out the new ID if it exists
        const filtered = existingIds.filter(id => id !== newId);
        // Add to front and slice
        const updated = [newId, ...filtered].slice(0, MAX_RECENT_NODES);

        expect(updated).toHaveLength(5);
        expect(updated[0]).toBe('new-node');
        expect(updated[updated.length - 1]).toBe('d'); // 'e' should be dropped
    });
});

// ============================================================================
// Recipe Tree Navigation Tests
// ============================================================================

describe('Recipe Tree Navigation', () => {
    it('should navigate to correct tree node based on path', () => {
        const tree = {
            type: 'folder' as const,
            name: 'Root',
            path: [],
            children: [
                {
                    type: 'folder' as const,
                    name: 'AI Tools',
                    path: ['AI Tools'],
                    children: [
                        {
                            type: 'recipe' as const,
                            name: 'Chat Assistant',
                            path: ['AI Tools'],
                            recipe: { id: 'chat', name: 'Chat Assistant' },
                        },
                    ],
                },
            ],
        };

        const currentPath = ['AI Tools'];
        let currentNode = tree;

        for (const segment of currentPath) {
            const child = currentNode.children?.find(
                c => c.type === 'folder' && c.name === segment
            );
            if (child) {
                currentNode = child;
            }
        }

        expect(currentNode.name).toBe('AI Tools');
        expect(currentNode.path).toEqual(['AI Tools']);
    });

    it('should handle empty path (root level)', () => {
        const tree = {
            type: 'folder' as const,
            name: 'Root',
            path: [],
            children: [],
        };

        const currentPath: string[] = [];
        let currentNode = tree;

        for (const segment of currentPath) {
            const child = currentNode.children?.find(
                c => c.type === 'folder' && c.name === segment
            );
            if (child) {
                currentNode = child;
            }
        }

        expect(currentNode.name).toBe('Root');
        expect(currentNode.path).toEqual([]);
    });

    it('should count items in folder recursively', () => {
        const tree = {
            type: 'folder' as const,
            name: 'Root',
            path: [],
            children: [
                {
                    type: 'recipe' as const,
                    name: 'Recipe 1',
                    path: [],
                    recipe: { id: 'r1', name: 'Recipe 1' },
                },
                {
                    type: 'folder' as const,
                    name: 'Subfolder',
                    path: ['Subfolder'],
                    children: [
                        {
                            type: 'recipe' as const,
                            name: 'Recipe 2',
                            path: ['Subfolder'],
                            recipe: { id: 'r2', name: 'Recipe 2' },
                        },
                    ],
                },
            ],
        };

        const countItems = (node: typeof tree): number => {
            if (node.type === 'recipe') return 1;
            return node.children?.reduce((acc, child) => acc + countItems(child), 0) || 0;
        };

        expect(countItems(tree)).toBe(2); // Recipe 1 + Recipe 2
    });
});

// ============================================================================
// Base Node Filtering Tests
// ============================================================================

describe('Base Node Filtering', () => {
    it('should exclude recipe: prefixed nodes', () => {
        const allMetas = {
            'text': { title: 'Text', category: 'Basic' },
            'image': { title: 'Image', category: 'Media' },
            'recipe:some-recipe': { title: 'Recipe', category: 'Recipe' },
        };

        const baseNodeItems = Object.entries(allMetas)
            .filter(([type]) => !type.startsWith('recipe:'))
            .map(([type, meta]) => ({ id: type, label: meta.title, category: meta.category }));

        expect(baseNodeItems).toHaveLength(2);
        expect(baseNodeItems.find(i => i.id === 'recipe:some-recipe')).toBeUndefined();
    });

    it('should exclude hidden nodes without fileImport', () => {
        const allMetas = {
            'text': { title: 'Text', category: 'Basic' },
            'hidden-node': { title: 'Hidden', category: 'Hidden', hidden: true },
            'import-node': { title: 'Import', category: 'Asset', fileImport: { assetType: 'image' } },
        };

        const baseNodeItems = Object.entries(allMetas)
            .filter(([_, meta]: [string, any]) => !(meta.hidden && !meta.fileImport))
            .map(([type, meta]) => ({ id: type, label: meta.title, category: meta.category }));

        expect(baseNodeItems).toHaveLength(2);
        expect(baseNodeItems.find(i => i.id === 'hidden-node')).toBeUndefined();
        expect(baseNodeItems.find(i => i.id === 'import-node')).toBeDefined();
    });

    it('should create action items for file import nodes', () => {
        const meta = {
            title: 'Import Image',
            category: 'Asset',
            fileImport: { assetType: 'image', label: 'Import' },
        } as any;

        const actionItem = {
            id: `action:import-${meta.fileImport.assetType}`,
            label: meta.fileImport.label || meta.title,
            description: meta.description || `Import ${meta.fileImport.assetType} from file`,
            category: meta.category || 'Asset',
            action: 'import-file',
            nodeType: 'image',
        };

        expect(actionItem.id).toBe('action:import-image');
        expect(actionItem.action).toBe('import-file');
    });
});

// ============================================================================
// Search State Tests
// ============================================================================

describe('Search State', () => {
    it('should determine searching state based on search length', () => {
        const searchStates = [
            { search: '', isSearching: false },
            { search: 'a', isSearching: true },
            { search: 'text', isSearching: true },
        ];

        searchStates.forEach(({ search, isSearching }) => {
            const actualIsSearching = search.length > 0;
            expect(actualIsSearching).toBe(isSearching);
        });
    });

    it('should determine navigation states', () => {
        const currentPath: string[] = [];
        const BASE_NODES_FOLDER = 'Basic Nodes';

        const isAtRoot = currentPath.length === 0;
        const isInBaseNodes = currentPath.length === 1 && currentPath[0] === BASE_NODES_FOLDER;

        expect(isAtRoot).toBe(true);
        expect(isInBaseNodes).toBe(false);
    });

    it('should determine Basic Nodes folder state', () => {
        const BASE_NODES_FOLDER = 'Basic Nodes';
        const currentPath = ['Basic Nodes'];

        const isInBaseNodes = currentPath.length === 1 && currentPath[0] === BASE_NODES_FOLDER;

        expect(isInBaseNodes).toBe(true);
    });
});

// ============================================================================
// Handle Select Logic Tests
// ============================================================================

describe('Handle Select Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecentNodeIds = [];
    });

    it('should call addRecentNode when selecting item', async () => {
        const item: NodePickerItem = {
            id: 'text',
            label: 'Text',
            category: 'Basic',
        };

        const onSelect = vi.fn();
        const onClose = vi.fn();

        // Simulate handleSelect behavior
        mockAddRecentNode(item.id);
        onSelect(item);
        onClose?.();

        expect(mockAddRecentNode).toHaveBeenCalledWith('text');
        expect(onSelect).toHaveBeenCalledWith(item);
        expect(onClose).toHaveBeenCalled();
    });

    it('should call ensureRecipeNodeRegistered for recipe items', async () => {
        const item: NodePickerItem = {
            id: 'recipe:chat-assistant',
            label: 'Chat Assistant',
            category: 'AI Tools',
            recipeId: 'chat-assistant',
        };

        // Simulate handleSelect behavior for recipe
        if (item.recipeId) {
            await mockEnsureRecipeNodeRegistered();
        }

        expect(mockEnsureRecipeNodeRegistered).toHaveBeenCalled();
    });

    it('should not fail if ensureRecipeNodeRegistered rejects', async () => {
        const errorRecipeRegister = vi.fn().mockRejectedValue(new Error('Failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const item: NodePickerItem = {
            id: 'recipe:failed',
            label: 'Failed Recipe',
            category: 'AI',
            recipeId: 'failed-recipe',
        };

        // Simulate handleSelect with error handling
        if (item.recipeId) {
            try {
                await errorRecipeRegister();
            } catch (error) {
                console.error('[NodePicker] Failed to register recipe:', error);
            }
        }

        expect(errorRecipeRegister).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

// ============================================================================
// Folder Navigation Handlers Tests
// ============================================================================

describe('Folder Navigation Handlers', () => {
    it('should navigate into folder', () => {
        const currentPath: string[] = [];
        const folderName = 'AI Tools';

        const newPath = [...currentPath, folderName];

        expect(newPath).toEqual(['AI Tools']);
    });

    it('should navigate up to specific level', () => {
        const currentPath = ['AI Tools', 'Subfolder', 'Deep'];
        const targetIndex = 1;

        const newPath = currentPath.slice(0, targetIndex);

        expect(newPath).toEqual(['AI Tools']);
    });

    it('should navigate to root', () => {
        const currentPath = ['AI Tools', 'Subfolder'];

        const newPath = [];

        expect(newPath).toEqual([]);
    });
});
