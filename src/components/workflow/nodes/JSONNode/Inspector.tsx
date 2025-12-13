import { FormAssetContent, isFormAsset, FieldDefinition } from '@/types/assets';
import { useAsset } from '@/hooks/useAsset';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SchemaBuilder } from '../../inspector/SchemaBuilder';
import { FormRenderer } from '../../inspector/FormRenderer';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/store/workflowStore';

export const JSONNodeInspector = ({ assetId, nodeId }: { assetId: string; nodeId?: string }) => {
    const { asset, setContent } = useAsset(assetId);
    const edges = useWorkflowStore(s => s.edges);
    const [activeTab, setActiveTab] = useState('values');

    // Saved content from asset
    const savedContent = useMemo(() => {
        if (asset && isFormAsset(asset.content)) {
            return asset.content;
        }
        return { schema: [], values: {} };
    }, [asset?.content]);

    // Draft state - local edits before save
    const [draftSchema, setDraftSchema] = useState<FieldDefinition[]>([]);
    const [draftValues, setDraftValues] = useState<Record<string, any>>({});
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize draft from saved content
    useEffect(() => {
        if (!isInitialized && savedContent) {
            setDraftSchema(savedContent.schema || []);
            setDraftValues(savedContent.values || {});
            setIsInitialized(true);
        }
    }, [savedContent, isInitialized]);

    // Reset draft when asset changes
    useEffect(() => {
        setDraftSchema(savedContent.schema || []);
        setDraftValues(savedContent.values || {});
        setIsInitialized(true);
    }, [assetId]);

    // Check if there are unsaved changes
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return JSON.stringify(draftSchema) !== JSON.stringify(savedContent.schema) ||
            JSON.stringify(draftValues) !== JSON.stringify(savedContent.values);
    }, [draftSchema, draftValues, savedContent, isInitialized]);

    // Init Logic: Ensure FormAssetContent structure exists
    useEffect(() => {
        if (asset && !isFormAsset(asset.content)) {
            const legacyValues = typeof asset.content === 'object' ? asset.content : {};
            const initContent: FormAssetContent = {
                schema: [],
                values: legacyValues || {}
            };
            if (JSON.stringify(asset.content) !== JSON.stringify(initContent)) {
                setContent(initContent);
            }
        }
    }, [asset?.content, setContent]);

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    if (!isFormAsset(asset.content)) {
        return <div className="text-xs text-muted-foreground p-4">Initializing JSON Structure...</div>;
    }

    // Get linked field keys (fields with incoming connections)
    const linkedFields = useMemo(() => {
        if (!nodeId) return new Set<string>();
        const connected = edges
            .filter(e => e.target === nodeId && e.targetHandle)
            .map(e => e.targetHandle!);
        return new Set(connected);
    }, [edges, nodeId]);

    // Handle draft changes (local only)
    const handleSchemaChange = (newSchema: FieldDefinition[]) => {
        setDraftSchema(newSchema);
    };

    const handleValuesChange = (newValues: Record<string, any>) => {
        setDraftValues(newValues);
    };

    // Save draft to asset
    const handleSave = () => {
        setContent({ schema: draftSchema, values: draftValues });
        toast.success('Changes saved');
    };

    // Discard changes
    const handleDiscard = () => {
        setDraftSchema(savedContent.schema || []);
        setDraftValues(savedContent.values || {});
        toast.info('Changes discarded');
    };

    return (
        <div className="flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="px-4 pt-3 shrink-0 flex items-center gap-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="values">Values</TabsTrigger>
                        <TabsTrigger value="schema">Schema</TabsTrigger>
                    </TabsList>
                    {hasChanges && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                            <AlertCircle className="h-3 w-3" />
                            Unsaved
                        </span>
                    )}
                </div>

                <TabsContent value="values" className="flex-1 p-4 min-h-0 overflow-y-auto">
                    <FormRenderer
                        schema={draftSchema}
                        values={draftValues}
                        onChange={handleValuesChange}
                        linkedFields={linkedFields}
                    />
                </TabsContent>

                <TabsContent value="schema" className="flex-1 p-4 min-h-0 overflow-y-auto">
                    <SchemaBuilder
                        schema={draftSchema}
                        onChange={handleSchemaChange}
                    />
                </TabsContent>
            </Tabs>

            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
                <div className="text-[10px] text-muted-foreground font-mono">
                    ID: {asset.id.slice(0, 8)}...
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
