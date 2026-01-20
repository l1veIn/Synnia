import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useSettings, isProviderConfigured, ProviderKey } from "@/lib/settings";
import { modelRegistry } from "@features/models";
import { useTranslation } from "react-i18next";
import { Thermometer, Hash } from "lucide-react";

export function GeneralSettingsPage() {
    const { t, i18n } = useTranslation('settings');
    const { settings, loading, setDefaultModel, setDefaultLLMParams } = useSettings();

    // Get all LLM models from unified registry, filter by configured providers
    const availableLLMOptions = useMemo(() => {
        const allModels = modelRegistry.getByCategory('llm');
        return allModels.filter(m => {
            const providers = m.supportedProviders || [m.provider];
            return providers.some(p => isProviderConfigured(settings, p as ProviderKey));
        });
    }, [settings]);

    // Get current selected model for max tokens limit
    const selectedModel = useMemo(() => {
        const modelId = settings?.defaultModels?.['llm-chat'];
        return modelId ? modelRegistry.get(modelId) : null;
    }, [settings?.defaultModels]);

    const maxOutputTokens = (selectedModel as any)?.maxOutputTokens || 4096;

    const handleDefaultLLMChange = async (model: string) => {
        try {
            await setDefaultModel('llm-chat', model);
            toast.success(t('general.llmUpdated'));
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        }
    };

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang);
        toast.success(t('general.languageChanged'));
    };

    const handleTemperatureChange = async (value: number[]) => {
        try {
            await setDefaultLLMParams({ temperature: value[0] });
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        }
    };

    const handleMaxTokensChange = async (value: number[]) => {
        try {
            await setDefaultLLMParams({ maxTokens: value[0] });
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        }
    };

    const temperature = settings?.defaultLLMParams?.temperature ?? 0.7;
    const maxTokens = settings?.defaultLLMParams?.maxTokens ?? 2048;

    return (
        <div className="h-full flex flex-col p-8 space-y-6 overflow-y-auto">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">{t('general.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('general.description')}</p>
            </div>

            <div className="space-y-6">
                {/* Language Selector */}
                <div className="space-y-2">
                    <Label>{t('general.language')}</Label>
                    <p className="text-[12px] text-muted-foreground">
                        {t('general.languageHelp')}
                    </p>
                    <Select
                        value={i18n.language}
                        onValueChange={handleLanguageChange}
                    >
                        <SelectTrigger className="w-full max-w-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="zh">中文</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Default LLM Selector */}
                <div className="space-y-2">
                    <Label>{t('general.defaultLLM')}</Label>
                    <p className="text-[12px] text-muted-foreground">
                        {t('general.llmHelp')}
                    </p>
                    <Select
                        value={settings?.defaultModels?.['llm-chat'] || 'gpt-4o-mini'}
                        onValueChange={handleDefaultLLMChange}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-full max-w-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableLLMOptions.length > 0 ? (
                                availableLLMOptions.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name} ({m.provider})
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="gpt-4o-mini" disabled>
                                    {t('general.configureProvider')}
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* LLM Parameters */}
                <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20 max-w-sm">
                    <h3 className="text-sm font-medium">{t('general.llmParams', 'LLM Parameters')}</h3>

                    {/* Temperature */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Thermometer className="h-3 w-3 text-muted-foreground" />
                                {t('general.temperature', 'Temperature')}
                            </Label>
                            <span className="text-xs text-muted-foreground">{temperature.toFixed(2)}</span>
                        </div>
                        <Slider
                            value={[temperature]}
                            onValueChange={handleTemperatureChange}
                            min={0}
                            max={2}
                            step={0.05}
                            disabled={loading}
                        />
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Hash className="h-3 w-3 text-muted-foreground" />
                                {t('general.maxTokens', 'Max Tokens')}
                            </Label>
                            <span className="text-xs text-muted-foreground">{maxTokens}</span>
                        </div>
                        <Slider
                            value={[maxTokens]}
                            onValueChange={handleMaxTokensChange}
                            min={256}
                            max={maxOutputTokens}
                            step={256}
                            disabled={loading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
