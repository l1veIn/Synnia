/**
 * Bot Theme Provider
 *
 * React context provider for bot theme customization.
 * Provides theme values and CSS variables to the bot UI.
 */

import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { useBotThemeStore } from './store';
import type { BotThemeConfig } from './types';
import { hslToString, FONT_SIZE_MAP, SPACING_MAP, BORDER_RADIUS_MAP } from './types';

// ============================================================================
// Context Types
// ============================================================================

interface BotThemeContextValue {
  /** Current theme configuration */
  theme: BotThemeConfig;

  /** CSS variables object for inline styles */
  cssVars: Record<string, string>;

  /** Message background style for user */
  userMessageStyle: React.CSSProperties;

  /** Message background style for assistant */
  assistantMessageStyle: React.CSSProperties;
}

const BotThemeContext = createContext<BotThemeContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface BotThemeProviderProps {
  children: ReactNode;
}

export function BotThemeProvider({ children }: BotThemeProviderProps) {
  const theme = useBotThemeStore((state) => state.theme);

  // Generate CSS variables from theme
  const cssVars = useMemo(() => {
    const { messageColors, accentColors, fontSize, spacing, borderRadius, fontFamily } = theme;

    return {
      // Message colors
      '--bot-user-bg': hslToString(messageColors.userBackground),
      '--bot-user-fg': hslToString(messageColors.userForeground),
      '--bot-assistant-bg': hslToString(messageColors.assistantBackground),
      '--bot-assistant-fg': hslToString(messageColors.assistantForeground),

      // Accent colors
      '--bot-primary': hslToString(accentColors.primary),
      '--bot-secondary': hslToString(accentColors.secondary),
      '--bot-muted': hslToString(accentColors.muted),
      '--bot-border': hslToString(accentColors.border),

      // Typography
      '--bot-font-family':
        fontFamily === 'System'
          ? 'system-ui, -apple-system, sans-serif'
          : fontFamily === 'JetBrains Mono'
            ? '"JetBrains Mono", monospace'
            : '"Inter", sans-serif',
      '--bot-font-size': `${FONT_SIZE_MAP[fontSize].message}px`,
      '--bot-input-font-size': `${FONT_SIZE_MAP[fontSize].input}px`,

      // Spacing
      '--bot-message-padding': SPACING_MAP[spacing].messagePadding,
      '--bot-input-padding': SPACING_MAP[spacing].inputPadding,
      '--bot-gap': SPACING_MAP[spacing].gap,

      // Border radius
      '--bot-border-radius': BORDER_RADIUS_MAP[borderRadius],
    } as Record<string, string>;
  }, [theme]);

  // Memoized message styles
  const userMessageStyle = useMemo(
    () => ({
      backgroundColor: theme.useCustomColors
        ? `hsl(${hslToString(theme.messageColors.userBackground)})`
        : undefined,
      color: theme.useCustomColors
        ? `hsl(${hslToString(theme.messageColors.userForeground)})`
        : undefined,
      borderRadius: theme.useCustomColors ? `var(--bot-border-radius)` : undefined,
    }),
    [theme]
  );

  const assistantMessageStyle = useMemo(
    () => ({
      backgroundColor: theme.useCustomColors
        ? `hsl(${hslToString(theme.messageColors.assistantBackground)})`
        : undefined,
      color: theme.useCustomColors
        ? `hsl(${hslToString(theme.messageColors.assistantForeground)})`
        : undefined,
      borderRadius: theme.useCustomColors ? `var(--bot-border-radius)` : undefined,
    }),
    [theme]
  );

  // Apply CSS variables to the bot panel container
  useEffect(() => {
    // Apply CSS variables to document for bot elements
    const root = document.documentElement;

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return () => {
      // Clean up CSS variables on unmount
      Object.keys(cssVars).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [cssVars]);

  const value: BotThemeContextValue = {
    theme,
    cssVars,
    userMessageStyle,
    assistantMessageStyle,
  };

  return <BotThemeContext.Provider value={value}>{children}</BotThemeContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the bot theme context
 * @throws Error if used outside BotThemeProvider
 */
export function useBotTheme(): BotThemeContextValue {
  const context = useContext(BotThemeContext);
  if (!context) {
    throw new Error('useBotTheme must be used within BotThemeProvider');
  }
  return context;
}
