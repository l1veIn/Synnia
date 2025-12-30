import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Key, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { autoGenerate, AutoGenerateOptions, getAllLLMPlugins } from '@features/models';
import { useSettings, isProviderConfigured, ProviderKey, getDefaultModel } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { openSettingsDialog } from '@/components/settings/SettingsDialog';

export interface AutoGenerateButtonProps {
    mode: AutoGenerateOptions['mode'];
    onGenerate: (content: any) => void;
    existingContent?: string;
    schema?: { key: string; label: string; type: string }[];
    /** For form-autofill mode: complete field definitions */
    formSchema?: { key: string; label?: string; type: string; placeholder?: string; widget?: string; options?: string[] }[];
    count?: number;
    placeholder?: string;
    className?: string;
    buttonLabel?: string;
    buttonVariant?: 'default' | 'ghost' | 'outline' | 'secondary';
    buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

export function AutoGenerateButton({
    mode,
    onGenerate,
    existingContent,
    schema,
    formSchema,
    count,
    placeholder = 'Describe what you want to generate...',
    className,
    buttonLabel,
    buttonVariant = 'ghost',
    buttonSize = 'sm',
}: AutoGenerateButtonProps) {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const { settings } = useSettings();

    // Get configured providers
    const configuredProviders = useMemo(() => {
        const providers: ProviderKey[] = [];
        if (settings) {
            const allProviderKeys: ProviderKey[] = ['openai', 'anthropic', 'google', 'deepseek', 'ollama', 'lmstudio'];
            allProviderKeys.forEach(key => {
                if (isProviderConfigured(settings, key)) {
                    providers.push(key);
                }
            });
        }
        return providers;
    }, [settings]);

    // Get available LLM models (filtered by configured providers)
    const availableModels = useMemo(() => {
        const allModels = getAllLLMPlugins();
        return allModels.filter(m => configuredProviders.includes(m.provider as ProviderKey));
    }, [configuredProviders]);

    // Auto-select model using ModelTab priority logic:
    // 1. Global default model for 'llm' category
    // 2. First available model from configured providers
    const selectedModelId = useMemo(() => {
        if (availableModels.length === 0) return null;

        // Try global default
        const defaultModelId = settings ? getDefaultModel(settings, 'llm') : null;
        if (defaultModelId && availableModels.some(m => m.id === defaultModelId)) {
            return defaultModelId;
        }

        // Fallback to first available
        return availableModels[0]?.id || null;
    }, [availableModels, settings]);

    const hasApiKeys = configuredProviders.length > 0;

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        if (!selectedModelId) {
            toast.error('No model available');
            return;
        }

        setLoading(true);
        try {
            const result = await autoGenerate({
                mode,
                prompt,
                existingContent,
                schema,
                formSchema,
                count,
                providerId: selectedModelId,
            });

            if (result.success && result.content !== undefined) {
                onGenerate(result.content);
                setPrompt('');
                setOpen(false);
                toast.success('Content generated');
            } else {
                toast.error(result.error || 'Generation failed');
            }
        } catch (e: any) {
            toast.error(e.message || 'Generation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleGenerate();
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={buttonVariant}
                    size={buttonSize}
                    className={cn('gap-1', className)}
                    title="Auto-generate with AI"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    {buttonLabel && <span>{buttonLabel}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                    {/* No API Keys state */}
                    {!hasApiKeys ? (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Key className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <h3 className="text-sm font-medium mb-1">No API Keys</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Configure API keys to use AI generation
                            </p>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setOpen(false);
                                    openSettingsDialog('models');
                                }}
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Open Settings
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs font-medium">
                                    {mode === 'text' && 'Generate Text'}
                                    {mode === 'table-rows' && `Generate ${count} Rows`}
                                    {mode === 'table-full' && 'Generate Table'}
                                    {mode === 'json-complete' && 'Complete JSON'}
                                    {mode === 'form-autofill' && 'Autofill Form'}
                                </Label>
                                <p className="text-[10px] text-muted-foreground">
                                    {mode === 'text' && 'Describe the content you want to generate'}
                                    {mode === 'table-rows' && 'Describe the data to fill the table'}
                                    {mode === 'table-full' && 'Describe the table structure and data'}
                                    {mode === 'json-complete' && 'Describe how to complete the JSON'}
                                    {mode === 'form-autofill' && 'Describe what this form should contain'}
                                </p>
                            </div>

                            <Textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                className="min-h-[80px] text-sm resize-none"
                                disabled={loading}
                            />

                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                    ⌘+Enter to generate
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleGenerate}
                                    disabled={loading || !prompt.trim()}
                                    className="gap-1"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Generate
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
