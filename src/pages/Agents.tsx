import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AgentEditorDialog } from '@/components/agent/AgentEditorDialog';
import { AgentDefinition } from '@/bindings';
import { toast } from 'sonner';
import { SYSTEM_AGENTS, SystemAgent } from '@features/agents/systemAgents';
import { AgentRunDialog } from '@/components/agent/AgentRunDialog';

export default function AgentsPage() {
    // We use a union type here because System Agents have extra properties (execute)
    // but for the UI list, we treat them as AgentDefinition
    const [agents, setAgents] = useState<(AgentDefinition | SystemAgent)[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<AgentDefinition | undefined>(undefined);
    const [runDialogOpen, setRunDialogOpen] = useState(false);
    const [runningAgent, setRunningAgent] = useState<AgentDefinition | null>(null);

    const loadAgents = async () => {
        try {
            const localAgents = await invoke<AgentDefinition[]>('get_agents');
            const uniqueLocal = localAgents.filter(la => !SYSTEM_AGENTS.find(sa => sa.id === la.id));
            setAgents([...SYSTEM_AGENTS, ...uniqueLocal]);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadAgents();
    }, []);

    const handleSave = async (agent: AgentDefinition) => {
        try {
            await invoke('save_agent', { agent });
            toast.success("Agent saved");
            setIsEditorOpen(false);
            loadAgents();
        } catch (e) {
            toast.error(`Failed to save: ${e}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await invoke('delete_agent', { agentId: id });
            toast.success("Agent deleted");
            loadAgents();
        } catch (e) {
            toast.error(`Failed to delete: ${e}`);
        }
    };

    const handleRunClick = (agent: AgentDefinition) => {
        setRunningAgent(agent);
        setRunDialogOpen(true);
    };

    const handleRunExecute = async (_agentId: string, inputs: any) => {
         // Since we are not in Canvas, we can't really "run" the agent to modify the graph.
         // But we can test it.
         try {
            const result = await invoke('run_agent', { 
                agentDef: runningAgent, 
                inputs,
                contextNodeId: null 
            });
            console.log("Agent Result:", result);
            toast.success("Agent ran successfully (Check Console for Output)");
         } catch (e) {
            toast.error(`Agent failed: ${e}`);
         }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
                    <p className="text-muted-foreground">Manage your AI workforce.</p>
                </div>
                <Button onClick={() => { setEditingAgent(undefined); setIsEditorOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Agent
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map(agent => (
                    <Card key={agent.id} className="group hover:border-primary/50 transition-colors">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{agent.name}</CardTitle>
                                {agent.isSystem ? (
                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-bold">System</span>
                                ) : (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded uppercase font-bold">Custom</span>
                                )}
                            </div>
                            <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                                {agent.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" size="sm" onClick={() => handleRunClick(agent)}>
                                    Test Run
                                </Button>
                                {!agent.isSystem && (
                                    <>
                                        <Button variant="secondary" size="sm" onClick={() => { setEditingAgent(agent); setIsEditorOpen(true); }}>
                                            Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(agent.id)}>
                                            Delete
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <AgentEditorDialog 
                open={isEditorOpen} 
                onOpenChange={setIsEditorOpen} 
                agent={editingAgent} 
                onSave={handleSave} 
            />

            <AgentRunDialog
                open={runDialogOpen}
                onOpenChange={setRunDialogOpen}
                agent={runningAgent}
                onRun={handleRunExecute}
            />
        </div>
    );
}