/**
 * Recipe Store - Manages recipe metadata and manifest caching
 * 
 * Key responsibilities:
 * - Load and cache RecipeMeta[] from backend index
 * - On-demand loading of full RecipeManifest
 * - Promise caching to prevent duplicate loading
 * - Event listener for background index updates
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { RecipeManifest } from '@/domain/recipe/manifest';

// ============================================
// Types
// ============================================

/** Lightweight recipe metadata from index */
export interface RecipeMeta {
    id: string;
    source: 'builtin' | 'user' | 'marketplace';
    path: string;
    name: string;
    description?: string;
    category?: string;
    icon?: string;
    author?: string;
    version: number;
    cover?: string;
    tags: string[];
}

/** Scan result from backend */
export interface ScanResult {
    added: number;
    updated: number;
    removed: number;
}

// ============================================
// State
// ============================================

export interface RecipeStoreState {
    // Lightweight metadata list (loaded on startup)
    metas: RecipeMeta[];

    // Full manifest cache (loaded on-demand)
    manifests: Map<string, RecipeManifest>;

    // Loading state
    isLoadingMetas: boolean;
    isIndexing: boolean;

    // Promise cache to prevent duplicate loading
    _loadingPromises: Map<string, Promise<RecipeManifest>>;
}

// ============================================
// Actions
// ============================================

export interface RecipeStoreActions {
    /** Load all recipe metadata from index */
    loadMetas: () => Promise<void>;

    /** Load full manifest for a recipe (with caching) */
    loadManifest: (id: string) => Promise<RecipeManifest>;

    /** Batch load manifests (for project loading) */
    loadManifests: (ids: string[]) => Promise<Map<string, RecipeManifest>>;

    /** Trigger background index refresh */
    refreshIndex: () => Promise<void>;

    /** Get manifest from cache (sync, may return undefined) */
    getManifest: (id: string) => RecipeManifest | undefined;

    /** Setup event listeners (call on app init) */
    setupEventListeners: () => Promise<UnlistenFn>;
}

// ============================================
// Store
// ============================================

export const useRecipeStore = create<RecipeStoreState & RecipeStoreActions>()((set, get) => ({
    // Initial state
    metas: [],
    manifests: new Map(),
    isLoadingMetas: false,
    isIndexing: false,
    _loadingPromises: new Map(),

    // Load metadata from backend
    loadMetas: async () => {
        if (get().isLoadingMetas) return;

        set({ isLoadingMetas: true });
        try {
            const metas = await invoke<RecipeMeta[]>('list_indexed_recipes', {
                source: null,
                category: null,
                limit: null,
            });
            set({ metas, isLoadingMetas: false });
        } catch (error) {
            console.error('[RecipeStore] Failed to load metas:', error);
            set({ isLoadingMetas: false });
        }
    },

    // Load single manifest with caching
    loadManifest: async (id: string) => {
        const state = get();

        // Check cache first
        const cached = state.manifests.get(id);
        if (cached) return cached;

        // Check if already loading (prevent duplicate requests)
        const existing = state._loadingPromises.get(id);
        if (existing) return existing;

        // Create loading promise
        const promise = (async () => {
            try {
                const manifest = await invoke<RecipeManifest>('get_recipe_manifest_by_id', { id });

                // Update cache
                set((s) => {
                    const newManifests = new Map(s.manifests);
                    newManifests.set(id, manifest);
                    return { manifests: newManifests };
                });

                return manifest;
            } finally {
                // Remove from loading promises
                set((s) => {
                    const newPromises = new Map(s._loadingPromises);
                    newPromises.delete(id);
                    return { _loadingPromises: newPromises };
                });
            }
        })();

        // Store loading promise
        set((s) => {
            const newPromises = new Map(s._loadingPromises);
            newPromises.set(id, promise);
            return { _loadingPromises: newPromises };
        });

        return promise;
    },

    // Batch load manifests
    loadManifests: async (ids: string[]) => {
        const uniqueIds = [...new Set(ids)];
        const results = new Map<string, RecipeManifest>();

        await Promise.all(
            uniqueIds.map(async (id) => {
                try {
                    const manifest = await get().loadManifest(id);
                    results.set(id, manifest);
                } catch (error) {
                    console.warn(`[RecipeStore] Failed to load manifest ${id}:`, error);
                }
            })
        );

        return results;
    },

    // Trigger background refresh
    refreshIndex: async () => {
        if (get().isIndexing) return;

        set({ isIndexing: true });
        try {
            await invoke('sync_recipe_index_async');
            // Result will come via event
        } catch (error) {
            console.error('[RecipeStore] Failed to trigger refresh:', error);
            set({ isIndexing: false });
        }
    },

    // Get manifest from cache (sync)
    getManifest: (id: string) => {
        return get().manifests.get(id);
    },

    // Setup event listeners
    setupEventListeners: async () => {
        const unlistenIndexed = await listen<ScanResult>('recipes:indexed', (event) => {
            console.log('[RecipeStore] Index updated:', event.payload);
            set({ isIndexing: false });
            // Reload metas after index update
            get().loadMetas();
        });

        const unlistenError = await listen<string>('recipes:index_error', (event) => {
            console.error('[RecipeStore] Index error:', event.payload);
            set({ isIndexing: false });
        });

        // Return combined unlisten function
        return () => {
            unlistenIndexed();
            unlistenError();
        };
    },
}));

// ============================================
// Selectors
// ============================================

/** Get recipes grouped by category */
export const selectRecipesByCategory = (state: RecipeStoreState) => {
    const grouped: Record<string, RecipeMeta[]> = {};
    for (const meta of state.metas) {
        const category = meta.category || 'Other';
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(meta);
    }
    return grouped;
};

/** Get recipe by ID */
export const selectRecipeById = (id: string) => (state: RecipeStoreState) => {
    return state.metas.find((m) => m.id === id);
};
