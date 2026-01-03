/**
 * RecipeNode Inspector - 4-Tab Layout (Form, Model, Chat, Advanced)
 * Recipe V2 Architecture: Multi-turn AI Agent Container
 */

import { useMemo, useEffect, useState, useRef } from 'react';
import { getResolvedRecipe } from '@features/recipes';
import { useWorkflowStore } from '@/store/workflowStore';
import { useAsset } from '@/hooks/useAsset';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, AlertCircle, FileText, Bot, MessageSquare, Code } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';
import { FormRenderer } from '../../inspector/FormRenderer';
import type { RecipeAssetConfig, ModelConfig, ChatMessage } from '@/types/assets';

// Tab Components
import { ModelTab } from './Inspector/ModelTab';
import { ChatTab } from './Inspector/ChatTab';
import { AdvancedTab } from './Inspector/AdvancedTab';

interface RecipeNodeInspectorProps {
    assetId?: string;
    nodeId?: string;
}

export const RecipeNodeInspector = ({ assetId, nodeId }: RecipeNodeInspectorProps) => {
    const node = useWorkflowStore(s => nodeId ? s.nodes.find(n => n.id === nodeId) : undefined);
    const edges = useWorkflowStore(s => s.edges);

    // Get asset for values storage
    const { asset, setValue, updateConfig } = useAsset(assetId);

    // Get recipeId from asset.config (V2 architecture)
    const assetConfig = asset?.config as RecipeAssetConfig | undefined;
    const recipeId = assetConfig?.recipeId;

    // Get recipe definition (schema comes from here)
    const recipe = useMemo(() => recipeId ? getResolvedRecipe(recipeId) : null, [recipeId]);

    // RecordAsset: form values are stored directly in asset.value
    const savedValues = useMemo(() => {
        if (asset && typeof asset.value === 'object' && asset.value !== null) {
            return asset.value as Record<string, any>;
        }
        return {};
    }, [asset?.value]);

    // Get recipe-specific config
    const recipeConfig = useMemo((): RecipeAssetConfig => {
        return (assetConfig || { recipeId: recipeId || '' }) as RecipeAssetConfig;
    }, [assetConfig, recipeId]);

    // Draft state - local edits before save
    const [draftValues, setDraftValues] = useState<Record<string, any>>({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [activeTab, setActiveTab] = useState('form');

    // Track previous assetId to detect actual node switches
    const prevAssetIdRef = useRef<string | undefined>(undefined);

    // Effect 1: When assetId changes, mark as needing re-initialization
    useEffect(() => {
        if (prevAssetIdRef.current !== assetId) {
            prevAssetIdRef.current = assetId;
            setIsInitialized(false);
        }
    }, [assetId]);

    // Effect 2: Sync to savedValues when:
    // - Not initialized yet, OR
    // - savedValues changed externally and we have no local unsaved edits
    const prevSavedValuesRef = useRef<Record<string, any>>({});

    useEffect(() => {
        if (!isInitialized) {
            // First initialization
            setDraftValues(savedValues);
            setIsInitialized(true);
            prevSavedValuesRef.current = savedValues;
        } else {
            // Check if savedValues changed externally (e.g., from onConnect)
            const savedValuesChanged = JSON.stringify(savedValues) !== JSON.stringify(prevSavedValuesRef.current);
            if (savedValuesChanged) {
                // Update previous ref
                prevSavedValuesRef.current = savedValues;
                // Sync if no local unsaved changes (merge external updates with local drafts)
                // This merges new values without losing user's unsaved edits
                setDraftValues(prev => {
                    const merged = { ...savedValues };
                    // Keep local edits that differ from old saved values
                    for (const key of Object.keys(prev)) {
                        if (prev[key] !== prevSavedValuesRef.current[key]) {
                            merged[key] = prev[key]; // Keep local edit
                        }
                    }
                    return merged;
                });
            }
        }
    }, [savedValues, isInitialized]);

    // Check if there are unsaved changes
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return JSON.stringify(draftValues) !== JSON.stringify(savedValues);
    }, [draftValues, savedValues, isInitialized]);

    // Get linked field keys (fields with incoming connections)
    const linkedFields = useMemo(() => {
        if (!nodeId) return new Set<string>();

        const linkedKeys = edges
            .filter(e => e.target === nodeId && e.targetHandle)
            .map(e => {
                const handle = e.targetHandle!;
                if (handle.startsWith('field:')) {
                    return handle.slice(6);
                }
                return handle;
            });

        return new Set(linkedKeys);
    }, [edges, nodeId]);

    // Check model capabilities for Chat tab
    const hasChatCapability = useMemo(() => {
        const modelId = recipeConfig.modelConfig?.modelId;
        if (!modelId) return true; // Enable by default if no model selected

        // Use the capability utility to check if model supports chat
        // Import at top: import { supportsChat } from '@/features/models/utils';
        // For now, return true as most LLMs support chat
        return true;
    }, [recipeConfig.modelConfig]);

    if (!recipe) {
        return <div className="p-4 text-xs text-muted-foreground">Recipe not found: {recipeId}</div>;
    }

    // Handle draft changes (local only)
    const handleDraftChange = (newValues: Record<string, any>) => {
        setDraftValues(newValues);
    };

    // Save draft to asset.value directly
    const handleSave = () => {
        if (assetId && asset) {
            setValue(draftValues);
            toast.success('Changes saved');
        }
    };

    // Discard changes
    const handleDiscard = () => {
        setDraftValues(savedValues);
        toast.info('Changes discarded');
    };

    // Model config change handler
    const handleModelConfigChange = (modelConfig: ModelConfig) => {
        if (assetId && updateConfig) {
            updateConfig({ ...recipeConfig, modelConfig });
            // toast.success('Model configuration updated');
        }
    };

    // Chat message handler
    const handleSendMessage = (content: string) => {
        if (!assetId || !updateConfig) return;

        const currentMessages = recipeConfig.chatContext?.messages || [];
        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        updateConfig({
            ...recipeConfig,
            chatContext: {
                messages: [...currentMessages, newMessage],
            },
        });

        toast.success('Message sent');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Recipe Info Header */}
            <div className="px-4 py-3 border-b bg-muted/10">
                <div className="flex items-center gap-2">
                    {recipe.icon && <recipe.icon className="h-4 w-4 text-primary" />}
                    <span className="font-medium text-sm">{recipe.name}</span>
                    {recipe.category && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {recipe.category}
                        </span>
                    )}
                    {hasChanges && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Unsaved
                        </span>
                    )}
                </div>
                {recipe.description && (
                    <p className="text-[10px] text-muted-foreground mt-1">{recipe.description}</p>
                )}
            </div>

            {/* 4-Tab Layout */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-9">
                    <TabsTrigger value="form" className="gap-1.5 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        Form
                    </TabsTrigger>
                    <TabsTrigger value="model" className="gap-1.5 text-xs">
                        <Bot className="h-3.5 w-3.5" />
                        Model
                    </TabsTrigger>
                    <TabsTrigger
                        value="chat"
                        className={cn("gap-1.5 text-xs", !hasChatCapability && "opacity-50 cursor-not-allowed")}
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Chat
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className="gap-1.5 text-xs">
                        <Code className="h-3.5 w-3.5" />
                        Advanced
                    </TabsTrigger>
                </TabsList>

                {/* Form Tab */}
                <TabsContent value="form" className="flex-1 flex flex-col overflow-hidden mt-0">
                    {recipe.inputSchema.length > 0 ? (
                        <>
                            {/* Scrollable form content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <AutoGenerateButton
                                    mode="form-autofill"
                                    formSchema={recipe.inputSchema.map(f => ({
                                        key: f.key,
                                        label: f.label,
                                        type: f.type,
                                        placeholder: f.config?.placeholder,
                                        widget: f.widget,
                                        options: f.config?.options,
                                    }))}
                                    onGenerate={(values) => {
                                        setDraftValues(prev => ({ ...prev, ...values }));
                                        toast.success('Form auto-filled');
                                    }}
                                    placeholder="Describe what this recipe should do..."
                                    buttonLabel="✨ Autofill"
                                    buttonVariant="outline"
                                    buttonSize="sm"
                                    className="w-full"
                                />
                                <FormRenderer
                                    schema={recipe.inputSchema}
                                    values={draftValues}
                                    onChange={handleDraftChange}
                                    linkedFields={linkedFields}
                                />
                            </div>
                            {/* Fixed footer */}
                            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between shrink-0">
                                <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
                                    <div>Recipe: {recipe.id}</div>
                                    {assetId && <div>Asset: {assetId.slice(0, 8)}...</div>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasChanges && (
                                        <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-7 text-xs">
                                            Discard
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant={hasChanges ? "default" : "outline"}
                                        onClick={handleSave}
                                        className={cn("h-7 gap-1.5", hasChanges && "bg-primary")}
                                        disabled={!hasChanges}
                                    >
                                        <Save className="h-3.5 w-3.5" />
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-muted-foreground italic text-center py-8">
                            This recipe has no input parameters
                        </div>
                    )}
                </TabsContent>

                {/* Model Tab */}
                <TabsContent value="model" className="flex-1 overflow-y-auto mt-0">
                    <ModelTab
                        modelConfig={recipeConfig.modelConfig}
                        onModelConfigChange={handleModelConfigChange}
                        filterCategory={(recipe?.manifest as any)?.model?.category || 'llm'}
                        requiredCapabilities={(recipe?.manifest as any)?.model?.capabilities || []}
                    />
                </TabsContent>

                {/* Chat Tab */}
                <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
                    <ChatTab
                        messages={recipeConfig.chatContext?.messages || []}
                        onSendMessage={handleSendMessage}
                        disabled={!hasChatCapability || (recipeConfig.chatContext?.messages?.length ?? 0) === 0}
                    />
                </TabsContent>

                {/* Advanced Tab */}
                <TabsContent value="advanced" className="flex-1 overflow-hidden mt-0">
                    {asset && <AdvancedTab asset={asset as any} />}
                </TabsContent>
            </Tabs>
        </div>
    );
};