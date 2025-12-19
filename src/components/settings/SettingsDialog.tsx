// Simplified Settings Dialog
// API Key + Base URL management for cloud and local providers

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Eye, EyeOff, Check, RefreshCw, Cloud, Server } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useSettings,
  PROVIDER_INFO,
  ProviderKey,
  ProviderInfo,
  isProviderConfigured,
} from "@/lib/settings";
import { getAllLLMModels } from "@/lib/models/llm";

// Provider Input Component
function ProviderInput({
  provider,
  config,
  onChange,
  disabled,
}: {
  provider: ProviderInfo;
  config: { apiKey?: string; baseUrl?: string };
  onChange: (config: { apiKey?: string; baseUrl?: string }) => void;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(config.apiKey || '');
  const [localBaseUrl, setLocalBaseUrl] = useState(config.baseUrl || provider.defaultBaseUrl || '');

  useEffect(() => {
    setLocalApiKey(config.apiKey || '');
    setLocalBaseUrl(config.baseUrl || provider.defaultBaseUrl || '');
  }, [config, provider.defaultBaseUrl]);

  const handleBlur = () => {
    const newConfig: { apiKey?: string; baseUrl?: string } = {};
    if (localApiKey) newConfig.apiKey = localApiKey;
    if (localBaseUrl) newConfig.baseUrl = localBaseUrl;
    onChange(newConfig);
  };

  const isConfigured = provider.type === 'cloud' ? !!localApiKey : !!localBaseUrl;

  return (
    <div className="flex items-start gap-2 p-3 border rounded-lg bg-muted/20">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{provider.name}</span>
          <span className="text-[10px] text-muted-foreground">{provider.description}</span>
        </div>

        {/* API Key (for cloud providers) */}
        {provider.requiresApiKey && (
          <div className="flex items-center gap-2">
            <Input
              type={show ? "text" : "password"}
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              onBlur={handleBlur}
              placeholder={provider.placeholder}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}

        {/* Base URL (for local providers or optional for cloud) */}
        {provider.type === 'local' && (
          <div className="flex items-center gap-2">
            <Input
              value={localBaseUrl}
              onChange={(e) => setLocalBaseUrl(e.target.value)}
              onBlur={handleBlur}
              placeholder={provider.placeholder}
              className="h-8 text-xs font-mono"
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {isConfigured && (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 mt-1">
          <Check className="h-3.5 w-3.5 text-green-500" />
        </div>
      )}
    </div>
  );
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { settings, loading, updateProvider, setDefaultModel, refresh } = useSettings();

  const handleProviderChange = async (provider: ProviderKey, config: { apiKey?: string; baseUrl?: string }) => {
    try {
      await updateProvider(provider, config);
      const info = PROVIDER_INFO.find(p => p.key === provider);
      if (config.apiKey || config.baseUrl) {
        toast.success(`${info?.name || provider} configured`);
      }
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    }
  };

  const handleDefaultLLMChange = async (model: string) => {
    try {
      await setDefaultModel('llm-chat', model);
      toast.success("Default LLM updated");
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    }
  };

  // Filter available default LLM options based on configured providers
  const availableLLMOptions = useMemo(() => {
    const allModels = getAllLLMModels();
    return allModels.filter(m => {
      const provider = m.provider || m.supportedProviders[0];
      return provider ? isProviderConfigured(settings, provider) : false;
    });
  }, [settings]);

  const cloudProviders = PROVIDER_INFO.filter(p => p.type === 'cloud');
  const localProviders = PROVIDER_INFO.filter(p => p.type === 'local');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Settings
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-auto"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Configure AI providers for LLM and media generation
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="cloud" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cloud" className="text-xs">
              <Cloud className="h-3.5 w-3.5 mr-1.5" />
              Cloud
            </TabsTrigger>
            <TabsTrigger value="local" className="text-xs">
              <Server className="h-3.5 w-3.5 mr-1.5" />
              Local
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cloud" className="space-y-2 mt-4 max-h-[50vh] overflow-y-auto pr-1">
            {cloudProviders.map((provider) => (
              <ProviderInput
                key={provider.key}
                provider={provider}
                config={settings?.providers?.[provider.key] || {}}
                onChange={(config) => handleProviderChange(provider.key, config)}
                disabled={loading}
              />
            ))}
          </TabsContent>

          <TabsContent value="local" className="space-y-2 mt-4 max-h-[50vh] overflow-y-auto pr-1">
            {localProviders.map((provider) => (
              <ProviderInput
                key={provider.key}
                provider={provider}
                config={settings?.providers?.[provider.key] || {}}
                onChange={(config) => handleProviderChange(provider.key, config)}
                disabled={loading}
              />
            ))}
            <p className="text-[10px] text-muted-foreground pt-2">
              💡 Local providers run on your machine. Make sure the service is running before use.
            </p>
          </TabsContent>
        </Tabs>

        {/* Default LLM Section */}
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Default LLM
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Used for utility functions like Prompt Enhancer
          </p>
          <Select
            value={settings?.defaultModels?.['llm-chat'] || 'gpt-4o-mini'}
            onValueChange={handleDefaultLLMChange}
            disabled={loading}
          >
            <SelectTrigger className="h-9">
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
                  Configure a provider first
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Info */}
        <div className="text-[10px] text-muted-foreground pt-2 border-t">
          <p>🔒 Credentials are stored locally and never sent anywhere except the providers you configure.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
