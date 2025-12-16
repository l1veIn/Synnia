import { useState, useEffect } from "react";
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
import { Settings, Plus, Trash2, Star, Edit2, Check, X, Image as ImageIcon, Video as VideoIcon, Volume2 as AudioIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AIProvider,
  AIConfig,
  PROVIDER_PRESETS,
  LLMProviderKind,
  loadAIConfig,
  saveAIConfig,
  invalidateConfigCache,
  createDefaultConfig,
} from "@/lib/services/ai";
import {
  MediaConfig,
  MediaProvider,
  loadMediaConfig,
  saveMediaConfig,
  invalidateMediaConfigCache,
} from "@/lib/services/media";

function ProviderCard({
  provider,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault
}: {
  provider: AIProvider;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        {isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
        <div>
          <div className="font-medium text-sm">{provider.name}</div>
          <div className="text-xs text-muted-foreground">
            {provider.defaultModel} • {provider.apiKey ? '••••' + provider.apiKey.slice(-4) : 'No API Key'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={onSetDefault} title="Set as default">
            <Star className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ProviderForm({
  provider,
  onSave,
  onCancel
}: {
  provider?: AIProvider;
  onSave: (p: AIProvider) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<LLMProviderKind>(provider?.kind as LLMProviderKind || 'gemini');
  const [name, setName] = useState(provider?.name || '');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [apiKey, setApiKey] = useState(provider?.apiKey || '');
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel || '');

  useEffect(() => {
    if (!provider) {
      const preset = PROVIDER_PRESETS[kind];
      setName(preset.name || '');
      setBaseUrl(preset.baseUrl || '');
      setDefaultModel(preset.defaultModel || '');
    }
  }, [kind, provider]);

  const handleSave = () => {
    const preset = PROVIDER_PRESETS[kind];
    const newProvider: AIProvider = {
      id: provider?.id || `${kind}-${Date.now()}`,
      type: 'llm',
      kind,
      name: name || preset.name || kind,
      enabled: true,
      baseUrl: baseUrl || preset.baseUrl || '',
      apiKey,
      models: preset.models || [],
      defaultModel: defaultModel || preset.defaultModel || '',
    };
    onSave(newProvider);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
      <div className="space-y-2">
        <Label className="text-xs">Provider Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as LLMProviderKind)} disabled={!!provider}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini">Google Gemini</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic Claude</SelectItem>
            <SelectItem value="ollama">Ollama (Local)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Display Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Provider" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">API Key</Label>
        <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={kind === 'ollama' ? 'Not required' : 'sk-...'} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Base URL</Label>
        <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Default Model</Label>
        <Input value={defaultModel} onChange={e => setDefaultModel(e.target.value)} placeholder="model-name" />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Media config state
  const [mediaConfig, setMediaConfig] = useState<MediaConfig | null>(null);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [editingMediaProvider, setEditingMediaProvider] = useState<MediaProvider | null>(null);

  useEffect(() => {
    if (open) {
      loadAIConfig().then(setConfig);
      loadMediaConfig().then(setMediaConfig);
    }
  }, [open]);

  const handleSaveConfig = async (newConfig: AIConfig) => {
    setLoading(true);
    try {
      await saveAIConfig(newConfig);
      invalidateConfigCache();
      setConfig(newConfig);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = (provider: AIProvider) => {
    if (!config) return;
    const newConfig = {
      ...config,
      providers: [...config.providers, provider],
      defaultLLM: config.providers.length === 0 ? provider.id : config.defaultLLM,
    };
    handleSaveConfig(newConfig);
    setIsAdding(false);
  };

  const handleUpdateProvider = (provider: AIProvider) => {
    if (!config) return;
    const newConfig = {
      ...config,
      providers: config.providers.map(p => p.id === provider.id ? provider : p),
    };
    handleSaveConfig(newConfig);
    setEditingProvider(null);
  };

  const handleDeleteProvider = (providerId: string) => {
    if (!config) return;
    const newProviders = config.providers.filter(p => p.id !== providerId);
    const newConfig = {
      ...config,
      providers: newProviders,
      defaultLLM: config.defaultLLM === providerId
        ? (newProviders[0]?.id || '')
        : config.defaultLLM,
    };
    handleSaveConfig(newConfig);
  };

  const handleSetDefault = (providerId: string) => {
    if (!config) return;
    handleSaveConfig({ ...config, defaultLLM: providerId });
  };

  const llmProviders = config?.providers.filter(p => p.type === 'llm') || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure AI providers for LLM and media generation.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="llm" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="llm">LLM</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
          </TabsList>

          <TabsContent value="llm" className="space-y-3 mt-4">
            {editingProvider ? (
              <ProviderForm
                provider={editingProvider}
                onSave={handleUpdateProvider}
                onCancel={() => setEditingProvider(null)}
              />
            ) : isAdding ? (
              <ProviderForm
                onSave={handleAddProvider}
                onCancel={() => setIsAdding(false)}
              />
            ) : (
              <>
                {llmProviders.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    isDefault={provider.id === config?.defaultLLM}
                    onEdit={() => setEditingProvider(provider)}
                    onDelete={() => handleDeleteProvider(provider.id)}
                    onSetDefault={() => handleSetDefault(provider.id)}
                  />
                ))}

                {llmProviders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No providers configured. Add one to get started.
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Provider
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="media" className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            {editingMediaProvider ? (
              <MediaProviderForm
                provider={editingMediaProvider}
                onSave={(p) => {
                  if (!mediaConfig) return;
                  const exists = mediaConfig.providers.some(mp => mp.id === p.id);
                  const newProviders = exists
                    ? mediaConfig.providers.map(mp => mp.id === p.id ? p : mp)
                    : [...mediaConfig.providers, p];
                  const newConfig = { ...mediaConfig, providers: newProviders };
                  // Auto-set defaults based on mediaTypes
                  if (!exists) {
                    if (p.mediaTypes.includes('image') && !newConfig.defaultImageProvider) {
                      newConfig.defaultImageProvider = p.id;
                    }
                    if (p.mediaTypes.includes('video') && !newConfig.defaultVideoProvider) {
                      newConfig.defaultVideoProvider = p.id;
                    }
                    if (p.mediaTypes.includes('audio') && !newConfig.defaultAudioProvider) {
                      newConfig.defaultAudioProvider = p.id;
                    }
                  }
                  saveMediaConfig(newConfig).then(() => {
                    invalidateMediaConfigCache();
                    setMediaConfig(newConfig);
                    setEditingMediaProvider(null);
                    toast.success(exists ? 'Provider updated' : 'Provider added');
                  });
                }}
                onCancel={() => setEditingMediaProvider(null)}
              />
            ) : (
              <>
                {/* Image Providers Section */}
                <MediaProviderSection
                  title="Image Providers"
                  icon={<ImageIcon className="h-4 w-4" />}
                  providers={(mediaConfig?.providers || []).filter(p => p.mediaTypes.includes('image'))}
                  defaultProviderId={mediaConfig?.defaultImageProvider}
                  onSetDefault={(id) => {
                    if (!mediaConfig) return;
                    const newConfig = { ...mediaConfig, defaultImageProvider: id };
                    saveMediaConfig(newConfig).then(() => {
                      invalidateMediaConfigCache();
                      setMediaConfig(newConfig);
                    });
                  }}
                  onEdit={setEditingMediaProvider}
                  onDelete={(id) => {
                    if (!mediaConfig) return;
                    const newConfig = {
                      ...mediaConfig,
                      providers: mediaConfig.providers.filter(p => p.id !== id),
                      defaultImageProvider: mediaConfig.defaultImageProvider === id ? undefined : mediaConfig.defaultImageProvider,
                    };
                    saveMediaConfig(newConfig).then(() => {
                      invalidateMediaConfigCache();
                      setMediaConfig(newConfig);
                      toast.success('Provider deleted');
                    });
                  }}
                  onAdd={() => setEditingMediaProvider({ id: '', name: '', type: 'openai', mediaTypes: ['image'], apiKey: '' })}
                />

                {/* Video Providers Section */}
                <MediaProviderSection
                  title="Video Providers"
                  icon={<VideoIcon className="h-4 w-4" />}
                  providers={(mediaConfig?.providers || []).filter(p => p.mediaTypes.includes('video'))}
                  defaultProviderId={mediaConfig?.defaultVideoProvider}
                  onSetDefault={(id) => {
                    if (!mediaConfig) return;
                    const newConfig = { ...mediaConfig, defaultVideoProvider: id };
                    saveMediaConfig(newConfig).then(() => {
                      invalidateMediaConfigCache();
                      setMediaConfig(newConfig);
                    });
                  }}
                  onEdit={setEditingMediaProvider}
                  onDelete={(id) => {
                    if (!mediaConfig) return;
                    const newConfig = {
                      ...mediaConfig,
                      providers: mediaConfig.providers.filter(p => p.id !== id),
                      defaultVideoProvider: mediaConfig.defaultVideoProvider === id ? undefined : mediaConfig.defaultVideoProvider,
                    };
                    saveMediaConfig(newConfig).then(() => {
                      invalidateMediaConfigCache();
                      setMediaConfig(newConfig);
                      toast.success('Provider deleted');
                    });
                  }}
                  onAdd={() => setEditingMediaProvider({ id: '', name: '', type: 'fal', mediaTypes: ['video'], apiKey: '' })}
                />

                {/* Audio Providers Section */}
                <MediaProviderSection
                  title="Audio Providers"
                  icon={<AudioIcon className="h-4 w-4" />}
                  providers={(mediaConfig?.providers || []).filter(p => p.mediaTypes.includes('audio'))}
                  defaultProviderId={mediaConfig?.defaultAudioProvider}
                  onSetDefault={(id) => {
                    if (!mediaConfig) return;
                    const newConfig = { ...mediaConfig, defaultAudioProvider: id };
                    saveMediaConfig(newConfig).then(() => {
                      invalidateMediaConfigCache();
                      setMediaConfig(newConfig);
                    });
                  }}
                  onEdit={setEditingMediaProvider}
                  onDelete={(id) => {
                    if (!mediaConfig) return;
                    const newConfig = {
                      ...mediaConfig,
                      providers: mediaConfig.providers.filter(p => p.id !== id),
                      defaultAudioProvider: mediaConfig.defaultAudioProvider === id ? undefined : mediaConfig.defaultAudioProvider,
                    };
                    saveMediaConfig(newConfig).then(() => {
                      invalidateMediaConfigCache();
                      setMediaConfig(newConfig);
                      toast.success('Provider deleted');
                    });
                  }}
                  onAdd={() => setEditingMediaProvider({ id: '', name: '', type: 'custom', mediaTypes: ['audio'], apiKey: '' })}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Media Provider Form Component
function MediaProviderForm({
  provider,
  onSave,
  onCancel
}: {
  provider: MediaProvider;
  onSave: (p: MediaProvider) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<MediaProvider['type']>(provider.type || 'openai');
  const [name, setName] = useState(provider.name || '');
  const [apiKey, setApiKey] = useState(provider.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || '');

  useEffect(() => {
    if (!provider.id) {
      // New provider - set defaults based on type
      if (type === 'openai') {
        setName('OpenAI DALL-E');
      } else if (type === 'fal') {
        setName('Fal.ai');
      }
    }
  }, [type, provider.id]);

  const handleSave = () => {
    onSave({
      id: provider.id || `${type}-${Date.now()}`,
      type,
      name: name || type,
      mediaTypes: ['image'],
      apiKey,
      baseUrl: baseUrl || undefined,
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
      <div className="space-y-2">
        <Label className="text-xs">Provider Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI (DALL-E)</SelectItem>
            <SelectItem value="fal">Fal.ai</SelectItem>
            <SelectItem value="replicate">Replicate</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Provider name" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">API Key</Label>
        <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
      </div>

      {(type === 'custom' || type === 'fal') && (
        <div className="space-y-2">
          <Label className="text-xs">Base URL (optional)</Label>
          <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://..." />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="h-4 w-4 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

// Media Provider Section Component
function MediaProviderSection({
  title,
  icon,
  providers,
  defaultProviderId,
  onSetDefault,
  onEdit,
  onDelete,
  onAdd,
}: {
  title: string;
  icon: React.ReactNode;
  providers: MediaProvider[];
  defaultProviderId?: string;
  onSetDefault: (id: string) => void;
  onEdit: (provider: MediaProvider) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {title}
      </div>

      {providers.length > 0 ? (
        <div className="space-y-2">
          {providers.map(provider => (
            <div key={provider.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                {provider.id === defaultProviderId && (
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                )}
                <div>
                  <div className="font-medium text-sm">{provider.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {provider.type} • {provider.apiKey ? '••••' + provider.apiKey.slice(-4) : 'No API Key'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {provider.id !== defaultProviderId && (
                  <Button variant="ghost" size="sm" onClick={() => onSetDefault(provider.id)} title="Set as default">
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onEdit(provider)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="hover:text-destructive" onClick={() => onDelete(provider.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-xs border rounded-lg border-dashed">
          No providers configured
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Provider
      </Button>
    </div>
  );
}
