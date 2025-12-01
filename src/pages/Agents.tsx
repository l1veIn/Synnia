import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SynniaIcon } from "@/components/SynniaIcon";
import { 
  Search, Plus, Bot, ChevronLeft, Settings, 
  Play, Edit, Trash2, ShieldCheck, Globe 
} from "lucide-react";
import { AgentDefinition } from '@/types/synnia';
import { SYSTEM_AGENTS } from "@/lib/systemAgents"; // Restored
import { invoke } from '@tauri-apps/api/core'; // Restored
import { useCallback } from 'react'; // Restored

import { AgentEditorDialog } from "@/components/agent/AgentEditorDialog"; // Import
import { toast } from "sonner"; // Import

// ...

export default function AgentsPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    // Initialize with SYSTEM_AGENTS directly
    const [agents, setAgents] = useState<AgentDefinition[]>(SYSTEM_AGENTS);
    
    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);

    const refreshAgents = useCallback(async () => {
         try {
             const userAgents = await invoke<AgentDefinition[]>('get_agents');
             const uniqueUserAgents = userAgents.filter(ua => !SYSTEM_AGENTS.find(sa => sa.id === ua.id));
             setAgents([...SYSTEM_AGENTS, ...uniqueUserAgents]);
         } catch (e) {
             console.error(e);
         }
    }, []);

    useEffect(() => {
         refreshAgents();
    }, [refreshAgents]);

    const handleCreate = () => {
        setEditingAgent(null);
        setIsEditorOpen(true);
    };

    const handleEdit = (agent: AgentDefinition) => {
        if (agent.is_system) {
            toast.info("System agents cannot be edited directly. (Clone feature coming soon)");
            return;
        }
        setEditingAgent(agent);
        setIsEditorOpen(true);
    };
    
    const handleDelete = async (agentId: string) => {
        if (!confirm("Are you sure you want to delete this agent?")) return;
        try {
            await invoke('delete_agent', { agentId });
            toast.success("Agent deleted");
            refreshAgents();
        } catch (e) {
            toast.error(`Failed to delete: ${e}`);
        }
    };

    const handleSaveAgent = async (agent: AgentDefinition) => {
        await invoke('save_agent', { agent });
        refreshAgents();
    };

    // Filter Logic
    const filteredAgents = agents.filter(agent => 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="h-full w-full bg-background text-foreground flex flex-col overflow-hidden font-sans relative">
             <AgentEditorDialog 
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                agent={editingAgent}
                onSave={handleSaveAgent}
            />
            
             {/* Background Texture */}
             <div 
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-repeat z-0"
                style={{ backgroundImage: 'url("/assets/Seamless_Texture_Pack_app-texture-pack.png")', backgroundSize: '300px' }}
            />

            {/* Header */}
            <header className="border-b border-border/40 bg-background/50 backdrop-blur z-10 px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Bot className="w-6 h-6 text-primary" />
                            Agent Registry
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage your digital workforce. {agents.length} units active.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" disabled>
                        <Globe className="w-4 h-4 mr-2" />
                        Agent Store
                    </Button>
                    <Button className="shadow-lg shadow-primary/20" onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create New
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 z-10">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* Search & Filter Bar */}
                    <div className="flex items-center gap-4 bg-card/50 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
                        <Search className="w-5 h-5 text-muted-foreground ml-2" />
                        <Input 
                            placeholder="Search agents by name or capability..." 
                            className="border-none bg-transparent focus-visible:ring-0 text-lg h-auto p-0 placeholder:text-muted-foreground/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Agents Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredAgents.map((agent) => (
                            <AgentCard 
                                key={agent.id} 
                                agent={agent} 
                                onEdit={() => handleEdit(agent)}
                                onDelete={() => handleDelete(agent.id)}
                            />
                        ))}
                        
                        {/* New Agent Placeholder */}
                        <Button 
                            variant="outline" 
                            className="h-full min-h-[200px] border-dashed border-2 flex flex-col gap-4 hover:border-primary/50 hover:bg-accent/30 transition-all"
                            onClick={handleCreate}
                        >
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                <Plus className="w-6 h-6 opacity-50" />
                            </div>
                            <span className="font-medium text-muted-foreground">Summon New Agent</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-component: Agent Card
function AgentCard({ agent, onEdit, onDelete }: { agent: AgentDefinition, onEdit: () => void, onDelete: () => void }) {
    return (
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow border-border/60 bg-card/80 backdrop-blur-sm group relative">
            {/* Delete Button (Only for User Agents) */}
            {!agent.is_system && (
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            )}

            <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Bot className="w-6 h-6" />
                    </div>
                    {agent.is_system && (
                        <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            SYSTEM
                        </Badge>
                    )}
                </div>
                <CardTitle className="text-lg leading-tight truncate pr-4">{agent.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {agent.description || "No description provided."}
                </p>
            </CardContent>
            <CardFooter className="pt-0 gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
                    <Edit className="w-3.5 h-3.5 mr-2" />
                    {agent.is_system ? 'View' : 'Edit'}
                </Button>
                {/* Run button logic can be added here later, or just rely on Canvas context menu */}
            </CardFooter>
        </Card>
    );
}
