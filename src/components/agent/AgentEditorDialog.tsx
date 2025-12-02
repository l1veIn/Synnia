import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Re-added
import { AgentDefinition } from '@/types/project';
import { JsonSchemaEditor } from './JsonSchemaEditor';
import { v4 as uuidv4 } from 'uuid';

interface AgentEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agent?: AgentDefinition;
    onSave: (agent: AgentDefinition) => void;
}

export const AgentEditorDialog: React.FC<AgentEditorDialogProps> = ({ open, onOpenChange, agent, onSave }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [schema, setSchema] = useState("{}");

    useEffect(() => {
        if (open) {
            if (agent) {
                setName(agent.name);
                setDescription(agent.description || "");
                setSystemPrompt(agent.systemPrompt);
                setSchema(agent.inputSchema);
            } else {
                // Reset for new
                setName("");
                setDescription("");
                setSystemPrompt("You are a helpful assistant...");
                setSchema(JSON.stringify({
                    type: "object",
                    properties: {
                        prompt: { type: "string", title: "Prompt" }
                    },
                    required: ["prompt"]
                }, null, 2));
            }
        }
    }, [open, agent]);

    const handleSave = () => {
        const newAgent: AgentDefinition = {
            id: agent?.id || uuidv4(),
            name,
            description,
            systemPrompt,
            inputSchema: schema,
            outputConfig: agent?.outputConfig || null, // Default to null to match type
            isSystem: false
        };
        onSave(newAgent);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{agent ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Story Writer" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description..." />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>System Prompt</Label>
                        <Textarea 
                            className="font-mono text-sm min-h-[200px]" 
                            value={systemPrompt} 
                            onChange={e => setSystemPrompt(e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">
                            Use <code>{'{{variable}}'}</code> to inject values from the Input Schema.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Input Schema (JSON)</Label>
                        <JsonSchemaEditor value={schema} onChange={setSchema} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Agent</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
