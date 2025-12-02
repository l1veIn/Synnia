import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AgentDefinition } from '@/types/project';
import { SchemaForm, SchemaField } from './SchemaForm';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

interface AgentRunDialogProps {
    agent: AgentDefinition | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRun: (agentId: string, inputs: any) => Promise<void>;
}

export const AgentRunDialog: React.FC<AgentRunDialogProps> = ({ agent, open, onOpenChange, onRun }) => {
    const [formData, setFormData] = useState<any>({});
    const [schema, setSchema] = useState<SchemaField | null>(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        if (agent && open) {
            try {
                // Models.rs exports camelCase, so it is inputSchema
                const parsed = JSON.parse(agent.inputSchema);
                setSchema(parsed);
                // Initialize defaults
                const defaults: any = {};
                if (parsed.properties) {
                    Object.entries(parsed.properties).forEach(([k, v]: [string, any]) => {
                        if (v.default !== undefined) defaults[k] = v.default;
                    });
                }
                setFormData(defaults);
            } catch (e) {
                console.error("Invalid Schema JSON", e);
                setSchema(null);
            }
        }
    }, [agent, open]);

    const handleRun = async () => {
        if (!agent) return;
        
        // Basic Validation
        if (schema?.required) {
            const missing = schema.required.filter(field => !formData[field]);
            if (missing.length > 0) {
                toast.error(`Missing required fields: ${missing.join(', ')}`);
                return;
            }
        }

        setRunning(true);
        try {
            await onRun(agent.id, formData);
            onOpenChange(false); // Close on success
        } catch (e) {
            console.error(e);
        } finally {
            setRunning(false);
        }
    };

    if (!agent) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{agent.name}</DialogTitle>
                    <DialogDescription>
                        {agent.description || "Configure the parameters for this agent."}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
                    {schema ? (
                        <SchemaForm 
                            schema={schema} 
                            data={formData} 
                            onChange={setFormData} 
                        />
                    ) : (
                        <div className="text-red-500 text-sm">Invalid Agent Configuration (Schema Error)</div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleRun} disabled={running || !schema}>
                        {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        Run Agent
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};