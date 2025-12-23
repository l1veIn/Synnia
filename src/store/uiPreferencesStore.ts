/**
 * UI Preferences Store - Persisted user preferences
 * 
 * Stores UI-related preferences that should persist across sessions.
 * Uses zustand persist middleware with localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT_NODES = 3;

interface UIPreferencesState {
    // Recent nodes for NodePicker
    recentNodeIds: string[];
}

interface UIPreferencesActions {
    addRecentNode: (nodeId: string) => void;
    clearRecentNodes: () => void;
}

export const useUIPreferencesStore = create<UIPreferencesState & UIPreferencesActions>()(
    persist(
        (set) => ({
            // Initial State
            recentNodeIds: [],

            // Actions
            addRecentNode: (nodeId: string) => set((state) => {
                const filtered = state.recentNodeIds.filter(id => id !== nodeId);
                return {
                    recentNodeIds: [nodeId, ...filtered].slice(0, MAX_RECENT_NODES)
                };
            }),

            clearRecentNodes: () => set({ recentNodeIds: [] }),
        }),
        {
            name: 'synnia:ui-preferences',
        }
    )
);
