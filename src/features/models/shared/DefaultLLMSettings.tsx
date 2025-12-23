// Default LLM Settings Component
// Shared UI for LLM model configuration

import { Thermometer, Hash, FileJson } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ModelConfigProps } from '../types';

interface DefaultLLMSettingsProps extends ModelConfigProps {
    defaultTemperature?: number;
    maxOutputTokens?: number;
}

export function DefaultLLMSettings({
    value,
    onChange,
    disabled,
    defaultTemperature = 0.7,
    maxOutputTokens = 4096,
}: DefaultLLMSettingsProps) {
    const temperature = value?.temperature ?? defaultTemperature;
    const maxTokens = value?.maxTokens ?? maxOutputTokens;
    const jsonMode = value?.jsonMode ?? false;

    const updateConfig = (key: string, val: any) => {
        onChange({ ...value, [key]: val });
    };

    return (
        <div className="space-y-4">
            {/* Temperature */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Thermometer className="h-3.5 w-3.5" />
                        Temperature
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">{temperature.toFixed(2)}</span>
                </div>
                <Slider
                    value={[temperature]}
                    onValueChange={([v]) => updateConfig('temperature', v)}
                    min={0}
                    max={2}
                    step={0.05}
                    disabled={disabled}
                />
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Hash className="h-3.5 w-3.5" />
                        Max Tokens
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">{maxTokens}</span>
                </div>
                <Slider
                    value={[maxTokens]}
                    onValueChange={([v]) => updateConfig('maxTokens', v)}
                    min={256}
                    max={maxOutputTokens}
                    step={256}
                    disabled={disabled}
                />
            </div>

            {/* JSON Mode */}
            <div className="flex items-center justify-between py-1">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileJson className="h-3.5 w-3.5" />
                    JSON Mode
                </Label>
                <Switch
                    checked={jsonMode}
                    onCheckedChange={(v) => updateConfig('jsonMode', v)}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}
