/**
 * Bot Theme Store
 *
 * Zustand store for bot theme customization with Tauri persistence.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { BotThemeConfig } from './types';
import { DEFAULT_BOT_THEME, BOT_THEME_PRESETS } from './types';

// ============================================================================
// Store State
// ============================================================================

interface BotThemeState {
  /** Current theme configuration */
  theme: BotThemeConfig;
}

// ============================================================================
// Store Actions
// ============================================================================

interface BotThemeActions {
  /** Set the entire theme configuration */
  setTheme: (theme: BotThemeConfig) => void;

  /** Update specific theme properties */
  updateTheme: (updates: Partial<BotThemeConfig>) => void;

  /** Reset to default theme */
  resetTheme: () => void;

  /** Apply a preset theme by name */
  applyPreset: (presetName: string) => void;
}

// ============================================================================
// Combined Store Type
// ============================================================================

export type BotThemeStore = BotThemeState & BotThemeActions;

// ============================================================================
// Persistence Key
// ============================================================================

const THEME_STORAGE_KEY = 'synnia-bot-theme';

// ============================================================================
// Load Theme from Storage
// ============================================================================

function loadThemeFromStorage(): BotThemeConfig {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the loaded theme has required properties
      if (parsed && parsed.messageColors && parsed.accentColors) {
        return parsed as BotThemeConfig;
      }
    }
  } catch (error) {
    console.error('[BotThemeStore] Failed to load theme from storage:', error);
  }
  return DEFAULT_BOT_THEME;
}

// ============================================================================
// Save Theme to Storage
// ============================================================================

function saveThemeToStorage(theme: BotThemeConfig): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (error) {
    console.error('[BotThemeStore] Failed to save theme to storage:', error);
  }
}

// ============================================================================
// Create Store
// ============================================================================

export const useBotThemeStore = create<BotThemeStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    theme: loadThemeFromStorage(),

    // Actions
    setTheme: (newTheme) => {
      set({ theme: newTheme });
      saveThemeToStorage(newTheme);
    },

    updateTheme: (updates) => {
      const currentTheme = get().theme;
      const updatedTheme = {
        ...currentTheme,
        ...updates,
        // Deep merge nested objects if provided
        ...(updates.messageColors && {
          messageColors: { ...currentTheme.messageColors, ...updates.messageColors },
        }),
        ...(updates.accentColors && {
          accentColors: { ...currentTheme.accentColors, ...updates.accentColors },
        }),
      };

      // Remove the redundant nested objects that we merged
      if (updates.messageColors) {
        delete (updatedTheme as Partial<{ messageColors: unknown }>).messageColors;
      }
      if (updates.accentColors) {
        delete (updatedTheme as Partial<{ accentColors: unknown }>).accentColors;
      }

      const finalTheme: BotThemeConfig = {
        ...currentTheme,
        ...updates,
        messageColors: updates.messageColors
          ? { ...currentTheme.messageColors, ...updates.messageColors }
          : currentTheme.messageColors,
        accentColors: updates.accentColors
          ? { ...currentTheme.accentColors, ...updates.accentColors }
          : currentTheme.accentColors,
      };

      set({ theme: finalTheme });
      saveThemeToStorage(finalTheme);
    },

    resetTheme: () => {
      set({ theme: DEFAULT_BOT_THEME });
      saveThemeToStorage(DEFAULT_BOT_THEME);
    },

    applyPreset: (presetName) => {
      const preset = BOT_THEME_PRESETS[presetName];
      if (preset) {
        set({ theme: preset });
        saveThemeToStorage(preset);
      }
    },
  }))
);

// Export store instance for direct access (e.g., in non-react code)
export const botThemeStore = useBotThemeStore;
