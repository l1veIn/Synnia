import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, PROVIDER_INFO, ProviderKey } from "@/lib/settings";
import { ProviderInput } from "../ProviderInput";
import { useTranslation } from "react-i18next";

export function ModelSettingsPage() {
    const { t } = useTranslation('settings');
    const { settings, loading, updateProvider, refresh } = useSettings();
    const cloudProviders = PROVIDER_INFO.filter(p => p.type === 'cloud');
    const localProviders = PROVIDER_INFO.filter(p => p.type === 'local');

    const handleProviderChange = async (provider: ProviderKey, config: { apiKey?: string; baseUrl?: string }) => {
        try {
            await updateProvider(provider, config);
            const info = PROVIDER_INFO.find(p => p.key === provider);
            if (config.apiKey || config.baseUrl) {
                toast.success(`${info?.name || provider} ${t('models.configured')}`);
            }
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        }
    };

    return (
        <div className="h-full flex flex-col pt-8 px-8 pb-0 overflow-hidden">
            <div className="flex items-start justify-between mb-6 shrink-0">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">{t('models.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('models.description')}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={refresh}
                    disabled={loading}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {t('models.refresh')}
                </Button>
            </div>

            <Tabs defaultValue="cloud" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
                    <TabsTrigger value="cloud">{t('models.cloudProviders')}</TabsTrigger>
                    <TabsTrigger value="local">{t('models.localProviders')}</TabsTrigger>
                </TabsList>

                <TabsContent value="cloud" className="flex-1 overflow-y-auto pb-8 pr-1 space-y-4">
                    <p className="text-xs text-muted-foreground px-1">
                        {t('models.cloudHint')}
                    </p>
                    <div className="grid gap-3">
                        {cloudProviders.map((provider) => (
                            <ProviderInput
                                key={provider.key}
                                provider={provider}
                                config={settings?.providers?.[provider.key] || {}}
                                onChange={(config) => handleProviderChange(provider.key, config)}
                                disabled={loading}
                            />
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="local" className="flex-1 overflow-y-auto pb-8 pr-1 space-y-4">
                    <p className="text-xs text-muted-foreground px-1">
                        {t('models.localHint')}
                    </p>
                    <div className="grid gap-3">
                        {localProviders.map((provider) => (
                            <ProviderInput
                                key={provider.key}
                                provider={provider}
                                config={settings?.providers?.[provider.key] || {}}
                                onChange={(config) => handleProviderChange(provider.key, config)}
                                disabled={loading}
                            />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
