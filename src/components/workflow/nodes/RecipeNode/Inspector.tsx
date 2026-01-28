/**
 * RecipeNode Inspector - 5-Tab Layout (Form, Model, Chat, Logs, Advanced)
 * Recipe V2 Architecture: Multi-turn AI Agent Container
 */

import { useMemo, useEffect, useState, useRef } from 'react';
import { getResolvedRecipe } from '@features/recipes';
import { useWorkflowStore } from '@/store/workflowStore';
import { useAsset } from '@/hooks/useAsset';
import { useInspector } from '@/hooks/useInspector';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, AlertCircle, FileText, Bot, MessageSquare, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';
import { FormRenderer } from '../../inspector/FormRenderer';
import type { RecipeAssetConfig, ModelConfig, RecipeExtra } from '@/features/recipes/types';

// Tab Components
// Tab Components
import { ModelTab } from './Inspector/ModelTab';
import { ChatTab } from './Inspector/ChatTab';
import { LogTab } from './Inspector/LogTab';
import { AdvancedTab } from './Inspector/AdvancedTab';
import { Settings } from 'lucide-react';

interface RecipeNodeInspectorProps {
    assetId?: string;
    nodeId?: string;
}

export const RecipeNodeInspector = ({ assetId, nodeId }: RecipeNodeInspectorProps) => {
    const node = useWorkflowStore(s => nodeId ? s.nodes.find(n => n.id === nodeId) : undefined);
    const { connectedFields } = useInspector(nodeId);

    // Get asset for values storage
    const { asset, setValue, updateConfig } = useAsset(assetId);

    // Get recipeId from asset.config.extra (V2 architecture with extra pattern)
    const assetConfig = asset?.config as RecipeAssetConfig | undefined;
    const extra = (assetConfig?.extra as RecipeExtra | undefined) ?? {};
    const recipeId = extra.recipeId;

    // Get recipe definition (schema comes from here)
    const recipe = useMemo(() => recipeId ? getResolvedRecipe(recipeId) : null, [recipeId]);

    // RecordAsset: form values are stored directly in asset.value
    const savedValues = useMemo(() => {
        if (asset && typeof asset.value === 'object' && asset.value !== null) {
            return asset.value as Record<string, any>;
        }
        return {};
    }, [asset?.value]);

    // Get recipe-specific config from extra
    const recipeConfig = useMemo(() => extra, [extra]);

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

    // Get linked field info from useInspector
    const linkedFieldsInfo = useMemo(() => {
        const info: Record<string, { sourceTitle: string; value: any }> = {};
        connectedFields.forEach((fieldInfo, key) => {
            info[key] = {
                sourceTitle: fieldInfo.sourceNodeTitle,
                value: fieldInfo.value,
            };
        });
        return info;
    }, [connectedFields]);

    const linkedFieldKeys = useMemo(() => {
        return new Set(connectedFields.keys());
    }, [connectedFields]);

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
            updateConfig({
                ...assetConfig,
                extra: { ...extra, modelConfig },
            });
            // toast.success('Model configuration updated');
        }
    };

    // handleSendMessage removed - ChatTab now uses useChatContext internally

    return (
        <div className="flex flex-col h-full">
            {/* Header / Description */}
            <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{recipe.name}</span>
                        {/* Status badges */}
                        {hasChanges && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Unsaved
                            </span>
                        )}
                    </div>
                </div>
                {recipe.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{recipe.description}</p>
                )}
            </div>

            {/* Split Layout: Tabs + Advanced Action */}
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col overflow-hidden"
            >
                <div className="flex items-center border-b px-2 h-10 bg-transparent">
                    <TabsList className="flex-1 justify-start rounded-none border-b-0 bg-transparent p-0 h-full gap-0 overflow-x-auto no-scrollbar">
                        <TabsTrigger value="form" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 text-xs font-medium min-w-fit flex-1">
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Form
                        </TabsTrigger>
                        <TabsTrigger value="model" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 text-xs font-medium min-w-fit flex-1">
                            <Bot className="h-3.5 w-3.5 mr-1.5" />
                            Model
                        </TabsTrigger>
                        <TabsTrigger
                            value="chat"
                            className={cn("h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 text-xs font-medium min-w-fit flex-1", !hasChatCapability && "opacity-50 cursor-not-allowed")}
                        >
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            Chat
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 text-xs font-medium min-w-fit flex-1">
                            <ScrollText className="h-3.5 w-3.5 mr-1.5" />
                            Logs
                        </TabsTrigger>
                    </TabsList>

                    <div className="w-px h-4 bg-border mx-1 shrink-0" />

                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 w-7 p-0 rounded-sm hover:bg-muted text-muted-foreground shrink-0",
                            activeTab === 'advanced' && "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                        onClick={() => setActiveTab(activeTab === 'advanced' ? 'form' : 'advanced')}
                        title="Advanced Settings (Prompts)"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>

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
                                    linkedFields={linkedFieldKeys}
                                    linkedFieldsInfo={linkedFieldsInfo}
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
                        modelConfig={extra.modelConfig}
                        onModelConfigChange={handleModelConfigChange}
                        filterCategory={(recipe?.manifest as any)?.executor?.model?.category || 'llm'}
                        requiredCapabilities={(recipe?.manifest as any)?.executor?.model?.capabilities || []}
                    />
                </TabsContent>

                {/* Chat Tab */}
                <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
                    <ChatTab
                        nodeId={nodeId}
                        recipeId={recipeId}
                        disabled={!hasChatCapability}
                    />
                </TabsContent>

                {/* Logs Tab */}
                <TabsContent value="logs" className="flex-1 overflow-hidden mt-0">
                    <LogTab nodeId={nodeId} />
                </TabsContent>

                {/* Advanced Tab */}
                <TabsContent value="advanced" className="flex-1 overflow-hidden mt-0">
                    {asset && <AdvancedTab asset={asset as any} recipe={recipe} />}
                </TabsContent>
            </Tabs>
        </div>
    );
};