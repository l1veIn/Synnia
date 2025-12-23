import { FieldDefinition, isRecordAsset, RecordAsset } from '@/types/assets';
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

export const FormNodeInspector = ({ assetId, nodeId }: { assetId: string; nodeId?: string }) => {
    const { asset, setValue, updateConfig } = useAsset(assetId);
    const edges = useWorkflowStore(s => s.edges);
    const nodes = useWorkflowStore(s => s.nodes);
    const [activeTab, setActiveTab] = useState('values');

    // Check if this node is docked (part of a docked chain)
    const isDocked = useMemo(() => {
        if (!nodeId) return false;
        const node = nodes.find(n => n.id === nodeId);
        return !!node?.data?.dockedTo;
    }, [nodeId, nodes]);

    // Get saved content from RecordAsset structure
    // - Schema is in asset.config.schema
    // - Values are in asset.value directly
    const savedSchema = useMemo(() => {
        if (asset && isRecordAsset(asset)) {
            return asset.config?.schema || [];
        }
        return [];
    }, [asset]);

    const savedValues = useMemo(() => {
        if (asset && typeof asset.value === 'object') {
            return asset.value as Record<string, any>;
        }
        return {};
    }, [asset?.value]);

    // Draft state - local edits before save
    const [draftSchema, setDraftSchema] = useState<FieldDefinition[]>([]);
    const [draftValues, setDraftValues] = useState<Record<string, any>>({});
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize draft from saved content
    useEffect(() => {
        if (!isInitialized && asset) {
            setDraftSchema(savedSchema);
            setDraftValues(savedValues);
            setIsInitialized(true);
        }
    }, [savedSchema, savedValues, isInitialized, asset]);

    // Reset draft when asset changes
    useEffect(() => {
        setDraftSchema(savedSchema);
        setDraftValues(savedValues);
        setIsInitialized(true);
    }, [assetId]);

    // Check if there are unsaved changes
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return JSON.stringify(draftSchema) !== JSON.stringify(savedSchema) ||
            JSON.stringify(draftValues) !== JSON.stringify(savedValues);
    }, [draftSchema, draftValues, savedSchema, savedValues, isInitialized]);

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

    // Init Logic: Ensure RecordAsset structure exists
    useEffect(() => {
        if (asset && !isRecordAsset(asset)) {
            // Migrate from old structure or initialize
            const existingValues = typeof asset.value === 'object' ? asset.value : {};
            setValue(existingValues);
            updateConfig({ schema: [] });
        }
    }, [asset, setValue, updateConfig]);

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    // Handle draft changes (local only)
    const handleSchemaChange = (newSchema: FieldDefinition[]) => {
        setDraftSchema(newSchema);
    };

    const handleValuesChange = (newValues: Record<string, any>) => {
        setDraftValues(newValues);
    };

    // Save draft to asset
    const handleSave = () => {
        setValue(draftValues);          // Values go to asset.value
        updateConfig({ schema: draftSchema }); // Schema goes to asset.config
        toast.success('Changes saved');
    };

    // Discard changes
    const handleDiscard = () => {
        setDraftSchema(savedSchema);
        setDraftValues(savedValues);
        toast.info('Changes discarded');
    };

    return (
        <div className="flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="px-4 pt-3 shrink-0 flex items-center gap-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="values">Values</TabsTrigger>
                        <TabsTrigger value="schema" className={cn(isDocked && "opacity-60")}>
                            Schema {isDocked && '🔒'}
                        </TabsTrigger>
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
                    {isDocked ? (
                        <div className="text-xs text-muted-foreground text-center py-8">
                            <p className="font-medium mb-2">Schema Locked</p>
                            <p>This node is part of a docked chain.</p>
                            <p>Undock to edit schema.</p>
                        </div>
                    ) : (
                        <SchemaBuilder
                            schema={draftSchema}
                            onChange={handleSchemaChange}
                        />
                    )}
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
