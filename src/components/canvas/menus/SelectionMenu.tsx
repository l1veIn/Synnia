import { 
    CustomMenuItem, 
    CustomMenuSeparator, 
    CustomMenuLabel
} from "@/components/ui/custom-menu";
import { AgentDefinition } from '@/types/project';
import { Trash2, Layers, User, Copy } from 'lucide-react';

interface SelectionMenuProps {
    selectionCount: number;
    agents: AgentDefinition[];
    onCallAgent: (agent: AgentDefinition) => void;
    onDelete: () => void;
    onClose: () => void;
}

export function SelectionMenu({ 
    selectionCount, agents, 
    onCallAgent, onDelete, onClose 
}: SelectionMenuProps) {
    
    return (
        <>
             <CustomMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">
                {selectionCount} Items Selected
            </CustomMenuLabel>
            
            <CustomMenuSeparator />
            <CustomMenuLabel className="text-xs text-muted-foreground">Batch Actions</CustomMenuLabel>
            
            {agents.map(agent => (
                <CustomMenuItem key={agent.id} onClick={() => { onCallAgent(agent); onClose(); }}>
                    {agent.isSystem ? <Layers className="w-3 h-3 mr-2 opacity-70" /> : <User className="w-3 h-3 mr-2 opacity-70" />}
                    {agent.name}
                </CustomMenuItem>
            ))}

            <CustomMenuSeparator />
            
            <CustomMenuItem disabled>
                <Copy className="w-4 h-4 mr-2" />
                Copy Selection
            </CustomMenuItem>

            <CustomMenuItem onClick={() => { onDelete(); onClose(); }} className="text-destructive focus:text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete All
            </CustomMenuItem>
        </>
    );
}