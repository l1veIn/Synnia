import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentDefinition } from '@/types/synnia';
import { JsonSchemaEditor } from './JsonSchemaEditor';
import { SchemaForm, SchemaField } from './SchemaForm';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Save, Code2, Box, Terminal, FileJson, Settings2, Bot } from 'lucide-react';
import { toast } from 'sonner';

interface AgentEditorDialogProps {
    agent?: AgentDefinition | null; // If null, create mode
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (agent: AgentDefinition) => Promise<void>;
}

const DEFAULT_SCHEMA = JSON.stringify({
    type: "object",
    properties: {
        input: { type: "string", title: "User Input" }
    },
    required: ["input"]
}, null, 2);

const DEFAULT_AGENT: AgentDefinition = {
    id: "",
    name: "New Agent",
    description: "",
    system_prompt: "You are a helpful AI assistant.",
    input_schema: DEFAULT_SCHEMA,
    output_config: JSON.stringify({
        format: "text",
        targetNode: "Text"
    }, null, 2),
    is_system: false
};

export const AgentEditorDialog: React.FC<AgentEditorDialogProps> = ({ agent, open, onOpenChange, onSave }) => {
    const [editingAgent, setEditingAgent] = useState<AgentDefinition>(DEFAULT_AGENT);
    const [isSchemaValid, setIsSchemaValid] = useState(true);
    const [parsedSchema, setParsedSchema] = useState<SchemaField | null>(null);
    const [previewData, setPreviewData] = useState<any>({});

    // Init
    useEffect(() => {
        if (open) {
            if (agent) {
                setEditingAgent({ ...agent });
            } else {
                setEditingAgent({ 
                    ...DEFAULT_AGENT, 
                    id: `usr_${Date.now()}` // Temp ID generation
                });
            }
            setPreviewData({});
        }
    }, [agent, open]);

    // Parse Schema for Preview
    useEffect(() => {
        try {
            const parsed = JSON.parse(editingAgent.input_schema);
            setParsedSchema(parsed);
        } catch (e) {
            setParsedSchema(null);
        }
    }, [editingAgent.input_schema]);

    const handleSave = async () => {
        if (!editingAgent.name) {
            toast.error("Name is required");
            return;
        }
        if (!isSchemaValid) {
            toast.error("Fix JSON Schema errors before saving");
            return;
        }
        
        try {
            await onSave(editingAgent);
            onOpenChange(false);
            toast.success("Agent saved successfully");
        } catch (e) {
            toast.error("Failed to save agent");
            console.error(e);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 [&>button]:hidden">
                {/* Accessibility Title */}
                <DialogTitle className="sr-only">Agent Editor</DialogTitle>

                {/* HEADER: Minimal Actions */}
                <div className="px-6 py-3 border-b border-border flex justify-between items-center bg-muted/30">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Bot className="w-5 h-5" />
                        <span className="font-medium text-foreground">{editingAgent.name || "Untitled Agent"}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave}>
                            <Save className="w-4 h-4 mr-2" />
                            Save Agent
                        </Button>
                    </div>
                </div>

                {/* TABS: General / Instruction / Input / Output */}
                <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b border-border bg-muted/10">
                        <TabsList className="bg-transparent p-0 h-12 w-full justify-start gap-8">
                            <TabsTrigger value="general" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0">
                                <Settings2 className="w-4 h-4 mr-2 opacity-70" />
                                General
                            </TabsTrigger>
                            <TabsTrigger value="instruction" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0">
                                <Terminal className="w-4 h-4 mr-2 opacity-70" />
                                Instruction
                            </TabsTrigger>
                            <TabsTrigger value="input" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0">
                                <Box className="w-4 h-4 mr-2 opacity-70" />
                                Input Schema
                            </TabsTrigger>
                            <TabsTrigger value="output" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0">
                                <FileJson className="w-4 h-4 mr-2 opacity-70" />
                                Output Config
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    
                    {/* TAB 1: GENERAL */}
                    <TabsContent value="general" className="flex-1 p-0 m-0 grid grid-cols-12 overflow-hidden h-full">
                        <div className="col-span-8 col-start-3 p-10 space-y-8">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-base">Agent Name</Label>
                                    <Input 
                                        value={editingAgent.name} 
                                        onChange={e => setEditingAgent({...editingAgent, name: e.target.value})}
                                        className="text-lg p-6"
                                        placeholder="e.g. Naming Specialist"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-base">ID (Unique Identifier)</Label>
                                    <Input 
                                        value={editingAgent.id} 
                                        disabled={!!agent} 
                                        onChange={e => setEditingAgent({...editingAgent, id: e.target.value})} 
                                        className="font-mono bg-muted/30"
                                        placeholder="e.g. usr_naming_v1"
                                    />
                                    <p className="text-xs text-muted-foreground">Cannot be changed after creation.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-base">Description</Label>
                                    <Textarea 
                                        value={editingAgent.description || ''} 
                                        onChange={e => setEditingAgent({...editingAgent, description: e.target.value})} 
                                        className="h-32 resize-none bg-muted/30"
                                        placeholder="What does this agent do?"
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB 2: INSTRUCTION (System Prompt) */}
                    <TabsContent value="instruction" className="flex-1 p-0 m-0 grid grid-cols-12 overflow-hidden h-full">
                        <div className="col-span-8 p-6 h-full overflow-hidden border-r border-border flex flex-col">
                            <Label className="mb-2">System Instruction (The Brain)</Label>
                            <Textarea 
                                value={editingAgent.system_prompt}
                                onChange={e => setEditingAgent({...editingAgent, system_prompt: e.target.value})}
                                className="font-mono text-sm flex-1 resize-none bg-muted/30 p-4 leading-relaxed"
                                placeholder="You are a helpful assistant..."
                            />
                        </div>
                        <div className="col-span-4 bg-muted/10 p-6 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-4 text-muted-foreground uppercase text-xs font-bold tracking-wider">
                                <Code2 className="w-4 h-4" /> Available Variables
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground mb-4">
                                    Define input variables in the "Input Schema" tab, then reference them here.
                                </p>
                                {parsedSchema?.properties && Object.keys(parsedSchema.properties).map(key => (
                                    <div key={key} className="flex items-center justify-between p-2 bg-background border border-border rounded text-xs font-mono">
                                        <span>{key}</span>
                                        <span className="text-muted-foreground">{`{{${key}}}`}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB 3: INPUT (Schema) */}
                    <TabsContent value="input" className="flex-1 p-0 m-0 grid grid-cols-12 overflow-hidden h-full">
                        <div className="col-span-7 p-6 h-full overflow-hidden border-r border-border">
                            <JsonSchemaEditor 
                                label="JSON Schema Definition"
                                value={editingAgent.input_schema}
                                onChange={(val, valid) => {
                                    setEditingAgent({...editingAgent, input_schema: val});
                                    setIsSchemaValid(valid);
                                }}
                            />
                        </div>
                        <div className="col-span-5 bg-muted/10 p-6 flex flex-col overflow-y-auto h-full">
                            <div className="flex items-center gap-2 mb-4 text-muted-foreground uppercase text-xs font-bold tracking-wider">
                                <Eye className="w-4 h-4" /> Live Preview
                            </div>
                            <Card className="w-full shadow-lg border-primary/20">
                                <CardHeader className="border-b border-border/50 pb-3 bg-muted/20">
                                    <CardTitle className="text-base">Run Agent</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    {parsedSchema ? (
                                        <SchemaForm 
                                            schema={parsedSchema} 
                                            data={previewData} 
                                            onChange={setPreviewData} 
                                        />
                                    ) : (
                                        <div className="text-center py-10 text-muted-foreground text-sm">
                                            Invalid Schema Configuration
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB 4: OUTPUT (Config) */}
                    <TabsContent value="output" className="flex-1 p-0 m-0 grid grid-cols-12 overflow-hidden h-full">
                        <div className="col-span-7 p-6 h-full overflow-hidden border-r border-border">
                            <JsonSchemaEditor 
                                label="Output Configuration (JSON)"
                                value={editingAgent.output_config || '{}'}
                                onChange={(val) => {
                                    setEditingAgent({...editingAgent, output_config: val});
                                }}
                            />
                        </div>
                        <div className="col-span-5 bg-muted/10 p-6 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-4 text-muted-foreground uppercase text-xs font-bold tracking-wider">
                                <Box className="w-4 h-4" /> Result Behavior
                            </div>
                            <div className="text-sm text-muted-foreground space-y-4">
                                <p>Define how the agent's output should be handled by the canvas.</p>
                                <ul className="list-disc pl-4 space-y-2">
                                    <li><strong>targetNode</strong>: "Text", "Image", "Prompt"</li>
                                    <li><strong>format</strong>: "json", "markdown", "text"</li>
                                </ul>
                            </div>
                        </div>
                    </TabsContent>

                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
