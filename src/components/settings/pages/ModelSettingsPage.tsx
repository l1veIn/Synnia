import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, ProviderKey } from "@/lib/settings";
import { ProviderInput } from "../ProviderInput";
import { useTranslation } from "react-i18next";
import {
    getAllProviders,
    getAvailableProviders,
    refreshAllProviders,
    refreshAvailableProviders,
    type BackendProviderInfo
} from "@/features/models";

export function ModelSettingsPage() {
    const { t } = useTranslation('settings');
    const { settings, loading, updateProvider, refresh } = useSettings();

    // Provider data from backend (single source of truth)
    const [providers, setProviders] = useState<BackendProviderInfo[]>([]);
    const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
    const [loadingProviders, setLoadingProviders] = useState(true);

    // Load providers from backend
    useEffect(() => {
        async function loadProviders() {
            setLoadingProviders(true);
            try {
                const [allProviders, available] = await Promise.all([
                    getAllProviders(),
                    getAvailableProviders()
                ]);
                setProviders(allProviders);
                setConfiguredProviders(available);
            } catch (error) {
                console.error('[Settings] Failed to load providers:', error);
                toast.error('Failed to load providers');
            } finally {
                setLoadingProviders(false);
            }
        }
        loadProviders();
    }, []);

    const cloudProviders = providers.filter(p => p.providerType === 'cloud');
    const localProviders = providers.filter(p => p.providerType === 'local');

    const handleProviderChange = async (provider: ProviderKey, config: { apiKey?: string; baseUrl?: string }) => {
        try {
            await updateProvider(provider, config);
            const info = providers.find(p => p.key === provider);
            if (config.apiKey || config.baseUrl) {
                toast.success(`${info?.name || provider} ${t('models.configured')}`);
                // Refresh available providers after config change
                refreshAvailableProviders();
                const available = await getAvailableProviders();
                setConfiguredProviders(available);
            }
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        }
    };

    const handleRefresh = async () => {
        refresh();
        refreshAllProviders();
        refreshAvailableProviders();
        const [allProviders, available] = await Promise.all([
            getAllProviders(),
            getAvailableProviders()
        ]);
        setProviders(allProviders);
        setConfiguredProviders(available);
    };

    // Convert BackendProviderInfo to ProviderInput format
    const toProviderInputFormat = (p: BackendProviderInfo) => ({
        key: p.key as ProviderKey,
        name: p.name,
        description: p.description,
        type: p.providerType as 'cloud' | 'local',
        placeholder: p.placeholder,
        defaultBaseUrl: p.defaultBaseUrl || '',
        requiresApiKey: p.requiresApiKey,
    });

    const isConfigured = (key: string) => configuredProviders.includes(key);

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
                    onClick={handleRefresh}
                    disabled={loading || loadingProviders}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${(loading || loadingProviders) ? 'animate-spin' : ''}`} />
                    {t('models.refresh')}
                </Button>
            </div>

            {loadingProviders ? (
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <Tabs defaultValue="cloud" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
                        <TabsTrigger value="cloud">
                            {t('models.cloudProviders')}
                            {cloudProviders.some(p => isConfigured(p.key)) && (
                                <Check className="ml-1.5 h-3.5 w-3.5 text-green-500" />
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="local">
                            {t('models.localProviders')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="cloud" className="flex-1 overflow-y-auto pb-8 pr-1 space-y-4">
                        <p className="text-xs text-muted-foreground px-1">
                            {t('models.cloudHint')}
                        </p>
                        <div className="grid gap-3">
                            {cloudProviders.map((provider) => (
                                <div key={provider.key} className="relative">
                                    {isConfigured(provider.key) && (
                                        <div className="absolute -top-1 -right-1 z-10">
                                            <div className="bg-green-500 rounded-full p-0.5">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        </div>
                                    )}
                                    <ProviderInput
                                        provider={toProviderInputFormat(provider)}
                                        config={settings?.providers?.[provider.key as ProviderKey] || {}}
                                        onChange={(config) => handleProviderChange(provider.key as ProviderKey, config)}
                                        disabled={loading}
                                    />
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="local" className="flex-1 overflow-y-auto pb-8 pr-1 space-y-4">
                        <p className="text-xs text-muted-foreground px-1">
                            {t('models.localHint')}
                        </p>
                        <p className="text-xs text-amber-500 px-1">
                            ⚠️ Local providers coming soon. Currently only cloud providers are supported.
                        </p>
                        <div className="grid gap-3 opacity-50">
                            {localProviders.map((provider) => (
                                <ProviderInput
                                    key={provider.key}
                                    provider={toProviderInputFormat(provider)}
                                    config={settings?.providers?.[provider.key as ProviderKey] || {}}
                                    onChange={(config) => handleProviderChange(provider.key as ProviderKey, config)}
                                    disabled={true}
                                />
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
