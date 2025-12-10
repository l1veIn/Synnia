import { memo } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { cn } from '@/lib/utils';
import { GripHorizontal, Layers } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { NodeConfig } from '@/types/node-config';
import { VerticalStackBehavior } from '@/lib/behaviors/VerticalStackBehavior';

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.RACK,
    title: 'Rack',
    category: 'Container',
    icon: Layers,
    description: 'Linear container for assets',
    defaultWidth: 300,
    defaultHeight: 400,
};

export const behavior = VerticalStackBehavior;

// --- Node Component ---
export const RackNode = memo(({ id, data, selected, width, height }: NodeProps<SynniaNode>) => {
    const highlightedGroupId = useWorkflowStore(state => state.highlightedGroupId);
    const isHighlighted = highlightedGroupId === id;
    
    const dockedTop = !!data.dockedTo;
    const dockedBottom = !!data.hasDockedFollower;

    return (
        <div 
            className={cn(
                "group relative flex flex-col border-2 transition-all duration-200 antialiased transform-gpu",
                "bg-card/40 min-w-[200px] min-h-[100px] backdrop-blur-md",
                selected ? "border-primary shadow-lg shadow-primary/20" : "border-border/40 hover:border-border",
                isHighlighted && "border-primary/50 bg-primary/5 ring-2 ring-primary/20",
                dockedTop ? "rounded-t-none border-t-0 mt-[-1px]" : "rounded-t-xl",
                dockedBottom ? "rounded-b-none border-b-0 mb-0" : "rounded-b-xl",
            )}
            style={{ width: width ?? 300, height: height ?? 400 }}
        >
            <Handle 
                type="target" 
                position={Position.Top} 
                className={cn("w-3 h-3 bg-primary border-2 border-background -top-[9px]", !dockedTop && "hover:bg-primary", dockedTop && "opacity-30 cursor-not-allowed")} 
                isConnectable={!dockedTop} 
            />

            {/* Header / Drag Handle */}
            <div className={cn(
                "custom-drag-handle h-9 w-full flex items-center justify-between px-3 bg-muted/30 border-b border-border/10 cursor-grab active:cursor-grabbing",
                dockedTop ? "rounded-t-none" : "rounded-t-[10px]"
            )}>
                <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-primary/70" />
                    <span className="text-xs font-medium text-foreground/80 select-none tracking-tight">
                        {data.title || 'Rack'}
                    </span>
                </div>
                <GripHorizontal className="w-4 h-4 text-muted-foreground/30" />
            </div>

            {/* Content Area */}
            <div className="flex-1 w-full relative min-h-0">
                 {/* Visual hint that this is a stack */}
                 <div className="absolute inset-x-4 top-0 bottom-4 border-x border-dashed border-border/20 pointer-events-none" />
            </div>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className={cn("w-3 h-3 bg-primary border-2 border-background -bottom-[9px]", !dockedBottom && "hover:bg-primary", dockedBottom && "opacity-30 cursor-not-allowed")} 
                isConnectable={!dockedBottom} 
            />
        </div>
    );
});

export { RackNode as Node };