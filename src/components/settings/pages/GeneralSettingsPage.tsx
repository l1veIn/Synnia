import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSettings, isProviderConfigured } from "@/lib/settings";
import { getAllLLMModels } from "@features/models";
import { useTranslation } from "react-i18next";

export function GeneralSettingsPage() {
    const { t, i18n } = useTranslation('settings');
    const { settings, loading, setDefaultModel } = useSettings();

    const availableLLMOptions = useMemo(() => {
        const allModels = getAllLLMModels();
        return allModels.filter(m => {
            const provider = m.provider || (m.supportedProviders || [])[0];
            return provider ? isProviderConfigured(settings, provider) : false;
        });
    }, [settings]);

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

    return (
        <div className="h-full flex flex-col p-8 space-y-6 overflow-y-auto">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">{t('general.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('general.description')}</p>
            </div>

            <div className="space-y-4">
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
            </div>
        </div>
    );
}
