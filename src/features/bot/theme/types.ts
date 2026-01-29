/**
 * Bot Theme Types
 *
 * Theme customization types for the AI Assistant Bot.
 * Supports custom colors, fonts, spacing, and other visual properties.
 */

// ============================================================================
// Color Theme Types
// ============================================================================

/**
 * HSL color representation (matches CSS custom property format)
 * Values are stored as strings for direct CSS variable usage
 */
export interface HslColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Bot message color scheme
 */
export interface MessageColors {
  /** User message background (HSL) */
  userBackground: HslColor;
  /** User message text (HSL) */
  userForeground: HslColor;
  /** Assistant message background (HSL) */
  assistantBackground: HslColor;
  /** Assistant message text (HSL) */
  assistantForeground: HslColor;
}

/**
 * Accent color scheme for the bot panel
 */
export interface AccentColors {
  /** Primary accent color (HSL) */
  primary: HslColor;
  /** Secondary accent color (HSL) */
  secondary: HslColor;
  /** Muted background color (HSL) */
  muted: HslColor;
  /** Border color (HSL) */
  border: HslColor;
}

// ============================================================================
// Typography Theme Types
// ============================================================================

/**
 * Font family options
 */
export type FontFamily = 'Inter' | 'System' | 'JetBrains Mono';

/**
 * Font size presets
 */
export type FontSize = 'small' | 'medium' | 'large';

/**
 * Font size mapping in pixels
 */
export const FONT_SIZE_MAP: Record<FontSize, { message: number; input: number }> = {
  small: { message: 12, input: 12 },
  medium: { message: 14, input: 14 },
  large: { message: 16, input: 16 },
} as const;

// ============================================================================
// Spacing Theme Types
// ============================================================================

/**
 * Spacing preset for message padding
 */
export type SpacingPreset = 'compact' | 'comfortable' | 'spacious';

/**
 * Spacing values in pixels
 */
export const SPACING_MAP: Record<
  SpacingPreset,
  { messagePadding: string; inputPadding: string; gap: string }
> = {
  compact: { messagePadding: '6px 10px', inputPadding: '6px 10px', gap: '6px' },
  comfortable: { messagePadding: '12px 16px', inputPadding: '12px 16px', gap: '12px' },
  spacious: { messagePadding: '20px 24px', inputPadding: '16px 20px', gap: '20px' },
} as const;

// ============================================================================
// Border Radius Types
// ============================================================================

/**
 * Border radius preset
 */
export type BorderRadiusPreset = 'none' | 'small' | 'medium' | 'large';

/**
 * Border radius values in pixels/rem
 */
export const BORDER_RADIUS_MAP: Record<BorderRadiusPreset, string> = {
  none: '0',
  small: '0.25rem',
  medium: '0.5rem',
  large: '0.75rem',
} as const;

// ============================================================================
// Complete Theme Configuration
// ============================================================================

/**
 * Complete bot theme configuration
 */
export interface BotThemeConfig {
  /** Theme name/identifier */
  name: string;

  /** Message colors */
  messageColors: MessageColors;

  /** Accent colors */
  accentColors: AccentColors;

  /** Typography settings */
  fontFamily: FontFamily;
  fontSize: FontSize;

  /** Spacing settings */
  spacing: SpacingPreset;

  /** Border radius */
  borderRadius: BorderRadiusPreset;

  /** Whether to use custom colors (false = use Synnia theme defaults) */
  useCustomColors: boolean;
}

// ============================================================================
// Preset Themes
// ============================================================================

/**
 * Default theme that matches Synnia's design system
 */
export const DEFAULT_BOT_THEME: BotThemeConfig = {
  name: 'Synnia Default',

  messageColors: {
    userBackground: { h: 332, s: 100, l: 50 }, // Primary pink
    userForeground: { h: 0, s: 0, l: 100 }, // White
    assistantBackground: { h: 216, s: 20, l: 90 }, // Muted gray
    assistantForeground: { h: 229, s: 16, l: 20 }, // Dark text
  },

  accentColors: {
    primary: { h: 332, s: 100, l: 50 }, // Brand pink
    secondary: { h: 216, s: 20, l: 90 }, // Light gray
    muted: { h: 216, s: 20, l: 90 }, // Muted
    border: { h: 216, s: 20, l: 85 }, // Border
  },

  fontFamily: 'Inter',
  fontSize: 'medium',
  spacing: 'comfortable',
  borderRadius: 'medium',
  useCustomColors: false,
};

/**
 * Compact theme for smaller screens or dense layouts
 */
export const COMPACT_BOT_THEME: BotThemeConfig = {
  ...DEFAULT_BOT_THEME,
  name: 'Compact',
  fontSize: 'small',
  spacing: 'compact',
  borderRadius: 'small',
};

/**
 * Spacious theme for better readability
 */
export const SPACIOUS_BOT_THEME: BotThemeConfig = {
  ...DEFAULT_BOT_THEME,
  name: 'Spacious',
  fontSize: 'large',
  spacing: 'spacious',
  borderRadius: 'large',
};

/**
 * High contrast theme
 */
export const HIGH_CONTRAST_BOT_THEME: BotThemeConfig = {
  name: 'High Contrast',

  messageColors: {
    userBackground: { h: 332, s: 100, l: 40 }, // Darker pink
    userForeground: { h: 0, s: 0, l: 100 }, // White
    assistantBackground: { h: 0, s: 0, l: 95 }, // Near white
    assistantForeground: { h: 0, s: 0, l: 0 }, // Pure black
  },

  accentColors: {
    primary: { h: 332, s: 100, l: 40 },
    secondary: { h: 0, s: 0, l: 90 },
    muted: { h: 0, s: 0, l: 90 },
    border: { h: 0, s: 0, l: 0 }, // Black borders
  },

  fontFamily: 'Inter',
  fontSize: 'large',
  spacing: 'comfortable',
  borderRadius: 'small',
  useCustomColors: true,
};

/**
 * All available preset themes
 */
export const BOT_THEME_PRESETS: Record<string, BotThemeConfig> = {
  default: DEFAULT_BOT_THEME,
  compact: COMPACT_BOT_THEME,
  spacious: SPACIOUS_BOT_THEME,
  highContrast: HIGH_CONTRAST_BOT_THEME,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert HSL color to CSS string
 */
export function hslToString({ h, s, l }: HslColor): string {
  return `${h} ${s}% ${l}%`;
}

/**
 * Parse CSS HSL string back to HSL object
 */
export function stringToHsl(str: string): HslColor | null {
  const match = str.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return null;

  const [, h, s, l] = match;
  return {
    h: parseInt(h, 10),
    s: parseInt(s, 10),
    l: parseInt(l, 10),
  };
}
