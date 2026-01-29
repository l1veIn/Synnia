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

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex p-0 bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl">
        {/* Sidebar Navigation */}
        <div className="w-56 bg-muted/30 border-r py-6 px-3 flex flex-col gap-1">
          <div className="px-3 mb-6">
            <h2 className="font-semibold text-lg tracking-tight">Theme</h2>
            <p className="text-xs text-muted-foreground">Customize appearance</p>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          <div className="mt-auto px-3">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs border-dashed text-muted-foreground hover:text-foreground" onClick={resetTheme}>
              <Minimize2 className="w-3 h-3 mr-2" /> Reset Defaults
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background/50">
          <DialogHeader className="mb-6">
            <DialogTitle>{tabs.find(t => t.id === activeTab)?.label}</DialogTitle>
          </DialogHeader>

          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(BOT_THEME_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleApplyPreset(key)}
                  className={cn(
                    'relative group overflow-hidden rounded-xl border p-4 text-left transition-all duration-300',
                    theme.name === preset.name
                      ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                      : 'border-border/50 hover:border-border hover:shadow-md bg-card/50'
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-medium text-sm">{preset.name}</div>
                    {theme.name === preset.name && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>

                  {/* Preview Mini-UI */}
                  <div className="space-y-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted/50" />
                      <div className="h-6 rounded-lg w-20" style={{ backgroundColor: `hsl(${hslToString(preset.messageColors.assistantBackground)})` }} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <div className="h-6 rounded-lg w-16" style={{ backgroundColor: `hsl(${hslToString(preset.messageColors.userBackground)})` }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50">
                <div>
                  <Label htmlFor="custom-colors" className="text-base">Enable Custom Colors</Label>
                  <p className="text-xs text-muted-foreground mt-1">Override preset colors with your own palette</p>
                </div>
                <Switch
                  id="custom-colors"
                  checked={theme.useCustomColors}
                  onCheckedChange={handleUseCustomColorsChange}
                />
              </div>

              {theme.useCustomColors ? (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-xs">Message Colors</h4>
                    <div className="grid grid-cols-1 gap-4">
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
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-xs">Accent Colors</h4>
                    <div className="grid grid-cols-1 gap-4">
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
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  <Palette className="w-10 h-10 mb-3 opacity-20" />
                  <p>Custom colors are disabled.</p>
                  <Button variant="link" size="sm" onClick={() => handleUseCustomColorsChange(true)} className="mt-2">
                    Enable to edit
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Typography Tab */}
          {activeTab === 'typography' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-6">
                <div className="space-y-3">
                  <Label>Font Family</Label>
                  <Select value={theme.fontFamily} onValueChange={(v) => handleFontFamilyChange(v as FontFamily)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter (Default)</SelectItem>
                      <SelectItem value="System">System UI</SelectItem>
                      <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Font Size</Label>
                  <Select value={theme.fontSize} onValueChange={(v) => handleFontSizeChange(v as FontSize)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (13px)</SelectItem>
                      <SelectItem value="medium">Medium (14px)</SelectItem>
                      <SelectItem value="large">Large (16px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Font Preview */}
              <div className="p-6 rounded-xl border bg-card shadow-sm">
                <div className="space-y-4" style={{ fontFamily: theme.fontFamily === 'System' ? 'system-ui' : theme.fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' : '"Inter", sans-serif' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">AI</span>
                    </div>
                    <div className="bg-muted p-3 rounded-lg rounded-tl-sm text-sm leading-relaxed max-w-[80%]">
                      The quick brown fox jumps over the lazy dog.
                    </div>
                  </div>
                  <div className="flex items-start gap-3 justify-end">
                    <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-sm text-sm leading-relaxed max-w-[80%]">
                      Customize your typography settings.
                    </div>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold">You</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Spacing Tab */}
          {activeTab === 'spacing' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-6">
                <div className="space-y-3">
                  <Label>Content Spacing</Label>
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

                <div className="space-y-3">
                  <Label>Border Radius</Label>
                  <Select
                    value={theme.borderRadius}
                    onValueChange={(v) => handleBorderRadiusChange(v as BorderRadiusPreset)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Square_</SelectItem>
                      <SelectItem value="small">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Spacing Preview */}
              <div className="p-6 rounded-xl border bg-muted/30">
                <div
                  className="flex flex-col w-full"
                  style={{
                    gap: `var(--bot-gap, 12px)`,
                  }}
                >
                  <div className="flex justify-end">
                    <div
                      className="bg-primary text-primary-foreground p-3 max-w-[80%] text-sm shadow-sm"
                      style={{ borderRadius: theme.borderRadius === 'none' ? '0' : theme.borderRadius === 'small' ? '4px' : theme.borderRadius === 'large' ? '12px' : '8px' }}
                    >
                      Check out this spacing.
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div
                      className="bg-background border p-3 max-w-[80%] text-sm shadow-sm"
                      style={{ borderRadius: theme.borderRadius === 'none' ? '0' : theme.borderRadius === 'small' ? '4px' : theme.borderRadius === 'large' ? '12px' : '8px' }}
                    >
                      Looks customizable and clean.
                    </div>
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
