import { FormAssetContent, isFormAsset } from '@/types/assets';
import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { getResolvedRecipe } from '@/lib/recipes';
import { FormRenderer } from '../../inspector/FormRenderer';
import { useWorkflowStore } from '@/store/workflowStore';
import { useAsset } from '@/hooks/useAsset';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';

interface RecipeNodeInspectorProps {
    assetId?: string;
    nodeId?: string;
}

export const RecipeNodeInspector = ({ assetId, nodeId }: RecipeNodeInspectorProps) => {
    const node = useWorkflowStore(s => nodeId ? s.nodes.find(n => n.id === nodeId) : undefined);
    const edges = useWorkflowStore(s => s.edges);
    const nodeData = node?.data as any;

    // Get recipe definition (schema comes from here)
    const recipeId = nodeData?.recipeId;
    const recipe = useMemo(() => recipeId ? getResolvedRecipe(recipeId) : null, [recipeId]);

    // Get asset for values storage
    const { asset, setValue } = useAsset(assetId);

    // Saved values from asset - now from asset.value
    const savedValues = useMemo(() => {
        const value = asset?.value as FormAssetContent | undefined;
        if (value && isFormAsset(value)) {
            return value.values || {};
        }
        return nodeData?.inputs || {};
    }, [asset?.value, nodeData]);

    // Draft state - local edits before save
    const [draftValues, setDraftValues] = useState<Record<string, any>>({});
    const [isInitialized, setIsInitialized] = useState(false);

    // Track previous assetId to detect actual node switches
    const prevAssetIdRef = useRef<string | undefined>(undefined);

    // Effect 1: When assetId changes, mark as needing re-initialization
    useEffect(() => {
        if (prevAssetIdRef.current !== assetId) {
            prevAssetIdRef.current = assetId;
            // Mark for re-init - will sync on next effect run when savedValues updates
            setIsInitialized(false);
        }
    }, [assetId]);

    // Effect 2: Sync to savedValues when not initialized
    // This runs after assetId change triggers re-init, AND after savedValues updates
    useEffect(() => {
        if (!isInitialized && savedValues) {
            setDraftValues(savedValues);
            setIsInitialized(true);
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

        // Find all incoming edges to this node
        const linkedKeys = edges
            .filter(e => e.target === nodeId && e.targetHandle)
            .map(e => {
                // targetHandle format: "field:fieldKey" → extract fieldKey
                const handle = e.targetHandle!;
                if (handle.startsWith('field:')) {
                    return handle.slice(6); // Remove 'field:' prefix
                }
                return handle;
            });

        return new Set(linkedKeys);
    }, [edges, nodeId]);

    // Init asset content if needed
    useEffect(() => {
        const value = asset?.value as FormAssetContent | undefined;
        if (asset && !isFormAsset(value)) {
            const legacyValues = typeof asset.value === 'object' ? asset.value : {};
            setValue({
                schema: [],
                values: legacyValues || {}
            });
        }
    }, [asset?.value, setValue]);

    if (!recipe) {
        return <div className="p-4 text-xs text-muted-foreground">Recipe not found: {recipeId}</div>;
    }

    // Handle draft changes (local only)
    const handleDraftChange = (newValues: Record<string, any>) => {
        setDraftValues(newValues);
    };

    // Save draft to asset
    const handleSave = () => {
        if (assetId) {
            setValue({
                schema: [],
                values: draftValues
            });
            toast.success('Changes saved');
        }
    };

    // Discard changes
    const handleDiscard = () => {
        setDraftValues(savedValues);
        toast.info('Changes discarded');
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

            {/* Input Form - Edit draft values */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">

                {recipe.inputSchema.length > 0 ? (
                    <>
                        {/* Autofill button */}
                        <AutoGenerateButton
                            mode="form-autofill"
                            formSchema={recipe.inputSchema.map(f => ({
                                key: f.key,
                                label: f.label,
                                type: f.type,
                                placeholder: f.rules?.placeholder,
                                widget: f.widget,
                                options: f.rules?.options,
                            }))}
                            onGenerate={(values) => {
                                // Merge generated values with existing
                                setDraftValues(prev => ({ ...prev, ...values }));
                                toast.success('Form auto-filled');
                            }}
                            placeholder="Describe what this recipe should do (e.g., 'generate creative product names for a coffee brand')..."
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
                    </>
                ) : (
                    <div className="text-xs text-muted-foreground italic text-center py-8">
                        This recipe has no input parameters
                    </div>
                )}
            </div>

            {/* Footer with Save Button */}
            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
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
        </div>
    );
};