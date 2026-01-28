/**
 * Bot Theme Customizer Component
 *
 * UI panel for customizing the bot chat appearance.
 * Allows users to modify colors, fonts, spacing, and border radius.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Palette, Type, Minimize2, Check } from 'lucide-react';
import { useBotThemeStore } from './store';
import {
  type BotThemeConfig,
  type HslColor,
  type FontFamily,
  type FontSize,
  type SpacingPreset,
  type BorderRadiusPreset,
  BOT_THEME_PRESETS,
  hslToString,
  stringToHsl,
} from './types';
import { cn } from '@/lib/utils';

// ============================================================================
// Color Picker Component
// ============================================================================

interface ColorPickerProps {
  label: string;
  color: HslColor;
  onChange: (color: HslColor) => void;
}

function ColorPicker({ label, color, onChange }: ColorPickerProps) {
  const [localColor, setLocalColor] = useState<HslColor>(color);

  const handleHueChange = (value: number[]) => {
    const newColor = { ...localColor, h: value[0] };
    setLocalColor(newColor);
    onChange(newColor);
  };

  const handleSaturationChange = (value: number[]) => {
    const newColor = { ...localColor, s: value[0] };
    setLocalColor(newColor);
    onChange(newColor);
  };

  const handleLightnessChange = (value: number[]) => {
    const newColor = { ...localColor, l: value[0] };
    setLocalColor(newColor);
    onChange(newColor);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs">{label}</Label>
        <div
          className="w-4 h-4 rounded border border-border"
          style={{ backgroundColor: `hsl(${hslToString(localColor)})` }}
        />
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center text-xs">
        <span className="text-muted-foreground">H</span>
        <Slider value={[localColor.h]} onValueChange={handleHueChange} min={0} max={360} step={1} />
        <span className="w-8 text-right">{localColor.h}</span>

        <span className="text-muted-foreground">S</span>
        <Slider value={[localColor.s]} onValueChange={handleSaturationChange} min={0} max={100} step={1} />
        <span className="w-8 text-right">{localColor.s}%</span>

        <span className="text-muted-foreground">L</span>
        <Slider value={[localColor.l]} onValueChange={handleLightnessChange} min={0} max={100} step={1} />
        <span className="w-8 text-right">{localColor.l}%</span>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Type
// ============================================================================

type Tab = 'presets' | 'colors' | 'typography' | 'spacing';

// ============================================================================
// Bot Theme Customizer Component
// ============================================================================

interface BotThemeCustomizerProps {
  /** Trigger element for opening the dialog */
  trigger?: React.ReactNode;
  /** Whether the dialog is open (controlled) */
  open?: boolean;
  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function BotThemeCustomizer({ trigger, open, onOpenChange }: BotThemeCustomizerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('presets');

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const theme = useBotThemeStore((state) => state.theme);
  const updateTheme = useBotThemeStore((state) => state.updateTheme);
  const setTheme = useBotThemeStore((state) => state.setTheme);
  const resetTheme = useBotThemeStore((state) => state.resetTheme);

  // Handlers
  const handleApplyPreset = (presetName: string) => {
    const preset = BOT_THEME_PRESETS[presetName];
    if (preset) {
      setTheme(preset);
    }
  };

  const handleFontFamilyChange = (value: FontFamily) => {
    updateTheme({ fontFamily: value });
  };

  const handleFontSizeChange = (value: FontSize) => {
    updateTheme({ fontSize: value });
  };

  const handleSpacingChange = (value: SpacingPreset) => {
    updateTheme({ spacing: value });
  };

  const handleBorderRadiusChange = (value: BorderRadiusPreset) => {
    updateTheme({ borderRadius: value });
  };

  const handleUseCustomColorsChange = (checked: boolean) => {
    updateTheme({ useCustomColors: checked });
  };

  const handleUserMessageColorChange = (colorKey: keyof BotThemeConfig['messageColors'], color: HslColor) => {
    updateTheme({
      messageColors: { ...theme.messageColors, [colorKey]: color },
    });
  };

  const handleAccentColorChange = (colorKey: keyof BotThemeConfig['accentColors'], color: HslColor) => {
    updateTheme({
      accentColors: { ...theme.accentColors, [colorKey]: color },
    });
  };

  // ============================================================================
  // Tabs
  // ============================================================================

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'presets', label: 'Presets', icon: <Check className="w-4 h-4" /> },
    { id: 'colors', label: 'Colors', icon: <Palette className="w-4 h-4" /> },
    { id: 'typography', label: 'Typography', icon: <Type className="w-4 h-4" /> },
    { id: 'spacing', label: 'Spacing', icon: <Minimize2 className="w-4 h-4" /> },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Customize Bot Theme
          </DialogTitle>
          <DialogDescription>Personalize the appearance of your AI assistant</DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(BOT_THEME_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handleApplyPreset(key)}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all hover:shadow-md',
                      theme.name === preset.name
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="flex gap-1 mt-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: `hsl(${hslToString(preset.messageColors.userBackground)})`,
                        }}
                      />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: `hsl(${hslToString(preset.messageColors.assistantBackground)})`,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={resetTheme}>
                Reset to Default
              </Button>
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-colors">Use Custom Colors</Label>
                <Switch
                  id="custom-colors"
                  checked={theme.useCustomColors}
                  onCheckedChange={handleUseCustomColorsChange}
                />
              </div>

              {theme.useCustomColors && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Message Colors</h4>
                    <ColorPicker
                      label="User Background"
                      color={theme.messageColors.userBackground}
                      onChange={(color) => handleUserMessageColorChange('userBackground', color)}
                    />
                    <ColorPicker
                      label="User Text"
                      color={theme.messageColors.userForeground}
                      onChange={(color) => handleUserMessageColorChange('userForeground', color)}
                    />
                    <ColorPicker
                      label="Assistant Background"
                      color={theme.messageColors.assistantBackground}
                      onChange={(color) => handleUserMessageColorChange('assistantBackground', color)}
                    />
                    <ColorPicker
                      label="Assistant Text"
                      color={theme.messageColors.assistantForeground}
                      onChange={(color) => handleUserMessageColorChange('assistantForeground', color)}
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Accent Colors</h4>
                    <ColorPicker
                      label="Primary"
                      color={theme.accentColors.primary}
                      onChange={(color) => handleAccentColorChange('primary', color)}
                    />
                    <ColorPicker
                      label="Muted"
                      color={theme.accentColors.muted}
                      onChange={(color) => handleAccentColorChange('muted', color)}
                    />
                    <ColorPicker
                      label="Border"
                      color={theme.accentColors.border}
                      onChange={(color) => handleAccentColorChange('border', color)}
                    />
                  </div>
                </>
              )}

              {!theme.useCustomColors && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Enable custom colors to customize the color scheme
                </div>
              )}
            </div>
          )}

          {/* Typography Tab */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={theme.fontFamily} onValueChange={(v) => handleFontFamilyChange(v as FontFamily)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter (Default)</SelectItem>
                    <SelectItem value="System">System UI</SelectItem>
                    <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Font Size</Label>
                <Select value={theme.fontSize} onValueChange={(v) => handleFontSizeChange(v as FontSize)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (13px)</SelectItem>
                    <SelectItem value="medium">Medium (14px)</SelectItem>
                    <SelectItem value="large">Large (16px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Preview */}
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-sm" style={{ fontFamily: theme.fontFamily === 'System' ? 'system-ui' : theme.fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' : '"Inter", sans-serif' }}>
                  <p className="mb-2">This is how your messages will look.</p>
                  <p className="text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
                </div>
              </div>
            </div>
          )}

          {/* Spacing Tab */}
          {activeTab === 'spacing' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Spacing</Label>
                <Select value={theme.spacing} onValueChange={(v) => handleSpacingChange(v as SpacingPreset)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Border Radius</Label>
                <Select
                  value={theme.borderRadius}
                  onValueChange={(v) => handleBorderRadiusChange(v as BorderRadiusPreset)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spacing Preview */}
              <div className="p-4 rounded-lg bg-muted">
                <div
                  className="space-y-2"
                  style={{
                    gap: `var(--bot-gap, 12px)`,
                  }}
                >
                  <div className="bg-primary text-primary-foreground p-2 rounded-md max-w-[80%] ml-auto text-sm">
                    User message
                  </div>
                  <div className="bg-background border p-2 rounded-md max-w-[80%] text-sm">
                    Assistant message
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
