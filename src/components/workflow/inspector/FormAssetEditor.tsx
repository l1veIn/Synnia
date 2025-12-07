import { Asset, FormAssetContent, isFormAsset, FieldDefinition } from '@/types/assets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SchemaBuilder } from './SchemaBuilder';
import { FormRenderer } from './FormRenderer';
import { useState, useEffect } from 'react';
import { SYSTEM_AGENTS, getSystemAgent } from '@/lib/systemAgents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface EditorProps {
    asset: Asset;
    onUpdate: (content: any) => void;
    onMetaUpdate: (meta: any) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export function FormAssetEditor({ asset, onUpdate, onMetaUpdate }: EditorProps) {
    const [activeTab, setActiveTab] = useState('values');

    // Init Logic: Ensure structure exists
    useEffect(() => {
        if (!isFormAsset(asset.content)) {
            const legacyValues = typeof asset.content === 'object' ? asset.content : {};
             const initContent: FormAssetContent = {
                schema: [],
                values: legacyValues || {}
            };
            if (JSON.stringify(asset.content) !== JSON.stringify(initContent)) {
                 onUpdate(initContent);
            }
        }
    }, [asset.content, onUpdate]);

    if (!isFormAsset(asset.content)) {
         return <div className="text-xs text-muted-foreground p-4">Initializing Form Structure...</div>;
    }

    const { schema, values } = asset.content;
    const currentAgentId = asset.metadata.extra?.agentId;

    const handleSchemaUpdate = (newSchema: any) => {
        onUpdate({ schema: newSchema, values });
    };

    const handleValuesUpdate = (newValues: any) => {
        onUpdate({ schema, values: newValues });
    };

    const handleAgentChange = (agentId: string) => {
        const newExtra = { ...asset.metadata.extra };
        if (agentId === 'none') {
            delete newExtra.agentId;
        } else {
            newExtra.agentId = agentId;
        }
        onMetaUpdate({ ...asset.metadata, extra: newExtra });
    };

    const applyAgentSchema = () => {
        if (!currentAgentId) return;
        const agent = getSystemAgent(currentAgentId);
        if (!agent) return;

        const newSchema = [...schema];
        const existingKeys = new Set(newSchema.map(f => f.key));
        
        let addedCount = 0;
        agent.requiredFields.forEach(key => {
            if (!existingKeys.has(key)) {
                newSchema.push({
                    id: generateId(),
                    key,
                    label: key.charAt(0).toUpperCase() + key.slice(1),
                    type: 'number', // Smart inference? For Division it's number. For now default to string or number based on key? 
                    // MVP: Default to number if key is 'a' or 'b', else string
                    widget: 'text',
                    rules: { required: true }
                });
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            handleSchemaUpdate(newSchema);
            setActiveTab('values'); // Switch to values to fill them
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Agent Binding Section */}
            <div className="px-4 py-3 border-b space-y-2 bg-muted/10">
                <div className="flex items-center justify-between">
                     <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bound Logic</Label>
                     {currentAgentId && (
                         <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-primary" onClick={applyAgentSchema} title="Add missing fields from recipe">
                            <Sparkles className="w-3 h-3 mr-1" /> Auto-Fill Schema
                         </Button>
                     )}
                </div>
                <Select value={currentAgentId || "none"} onValueChange={handleAgentChange}>
                    <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue placeholder="Select Recipe..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None (Pure Data)</SelectItem>
                        {SYSTEM_AGENTS.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="px-4 pt-2 shrink-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="values">Values</TabsTrigger>
                        <TabsTrigger value="schema">Schema</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="values" className="flex-1 p-4 min-h-0 overflow-y-auto">
                    <FormRenderer 
                        schema={schema} 
                        values={values} 
                        onChange={handleValuesUpdate} 
                    />
                </TabsContent>
                
                <TabsContent value="schema" className="flex-1 p-4 min-h-0 overflow-y-auto">
                    <SchemaBuilder 
                        schema={schema} 
                        onChange={handleSchemaUpdate} 
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}