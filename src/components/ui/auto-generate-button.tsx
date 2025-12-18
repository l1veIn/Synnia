import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { autoGenerate, AutoGenerateOptions, getAllLLMPlugins, LLMPlugin } from '@/lib/models/llm';
import { useSettings, isProviderConfigured, ProviderKey } from '@/lib/settings';
import { cn } from '@/lib/utils';

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
    /** Pre-selected model ID */
    modelId?: string;
    /** Callback when model changes */
    onModelChange?: (modelId: string) => void;
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
    modelId,
    onModelChange,
}: AutoGenerateButtonProps) {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>(modelId || 'default');
    const { settings } = useSettings();

    // Get available LLM models (filtered by configured providers)
    const availableModels = useMemo(() => {
        const allModels = getAllLLMPlugins();
        return allModels.filter(m => isProviderConfigured(settings, m.provider as ProviderKey));
    }, [settings]);

    // Sync external modelId
    useEffect(() => {
        if (modelId) setSelectedModel(modelId);
    }, [modelId]);

    const handleModelChange = (value: string) => {
        setSelectedModel(value);
        onModelChange?.(value);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
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
                providerId: selectedModel === 'default' ? undefined : selectedModel,
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
                    <div className="space-y-1">
                        <Label className="text-xs font-medium">
                            {mode === 'text' && 'Generate Text'}
                            {mode === 'table-rows' && `Generate ${count} Rows`}
                            {mode === 'table-full' && 'Generate Table'}
                            {mode === 'json-complete' && 'Complete JSON'}
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                            {mode === 'text' && 'Describe the content you want to generate'}
                            {mode === 'table-rows' && 'Describe the data to fill the table'}
                            {mode === 'table-full' && 'Describe the table structure and data'}
                            {mode === 'json-complete' && 'Describe how to complete the JSON'}
                        </p>
                    </div>

                    {/* Model selector */}
                    {availableModels.length > 0 && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Model</Label>
                            <Select value={selectedModel} onValueChange={handleModelChange}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    {availableModels.map((m: LLMPlugin) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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
                </div>
            </PopoverContent>
        </Popover>
    );
}

