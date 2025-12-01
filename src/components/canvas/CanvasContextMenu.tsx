import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils';
import { 
  Plus, Image as ImageIcon, FileText, Trash2, 
  Copy, MessageSquare, Scissors, Sparkles, Layers, Bot 
} from 'lucide-react';
import { AgentDefinition } from '@/types/synnia';

interface CanvasContextMenuProps {
  children: React.ReactNode;
  selectionCount: number;
  selectedNodeType?: string; 
  agents: AgentDefinition[];
  onAddNode: (type: string) => void;
  onImportImage: () => void;
  onDelete: () => void;
  onCallAgent: (agent: AgentDefinition) => void;
  onRemoveBackground?: () => void;
  onSetCover?: () => void;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({ 
  children, 
  selectionCount,
  selectedNodeType,
  agents,
  onAddNode,
  onImportImage,
  onDelete,
  onCallAgent,
  onRemoveBackground,
  onSetCover
}) => {
  
  const renderContent = () => {
    // Case 1: Multi-selection
    if (selectionCount > 1) {
        return (
            <>
                <Item icon={<Layers className="w-4 h-4" />} label="Group Selection (Todo)" disabled />
                <Item icon={<Sparkles className="w-4 h-4" />} label="Blend/Mix (Agent)" disabled />
                <ContextMenu.Separator className="h-px bg-border my-1" />
                <Item icon={<Trash2 className="w-4 h-4" />} label={`Delete ${selectionCount} items`} onClick={onDelete} shortcut="Del" intent="danger" />
            </>
        );
    }

    // Case 2: Single Node
    if (selectionCount === 1) {
        return (
            <>
                <ContextMenu.Sub>
                    <ContextMenu.SubTrigger className="flex items-center w-full px-2 py-1.5 text-sm outline-none cursor-default select-none hover:bg-accent hover:text-accent-foreground rounded-sm data-[state=open]:bg-accent">
                        <Bot className="w-4 h-4 mr-2 text-purple-500" />
                        Call Agent...
                        <div className="ml-auto pl-5 text-[10px] opacity-60">▶</div>
                    </ContextMenu.SubTrigger>
                    <ContextMenu.Portal>
                        <ContextMenu.SubContent className="min-w-[180px] bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md animate-in fade-in zoom-in-95 z-[100]">
                            {agents.length > 0 ? agents.map(agent => (
                                <Item 
                                    key={agent.id} 
                                    label={agent.name} 
                                    onClick={() => onCallAgent(agent)} 
                                />
                            )) : (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">No agents found</div>
                            )}
                        </ContextMenu.SubContent>
                    </ContextMenu.Portal>
                </ContextMenu.Sub>
                
                <ContextMenu.Separator className="h-px bg-border my-1" />
                
                {/* Image Specific Actions */}
                {selectedNodeType === 'Image' && (
                    <>
                        <Item 
                            icon={<ImageIcon className="w-4 h-4" />} 
                            label="Set as Cover" 
                            onClick={onSetCover} 
                        />
                        <ContextMenu.Separator className="h-px bg-border my-1" />
                    </>
                )}
                
                <ContextMenu.Sub>
                    <ContextMenu.SubTrigger className="flex items-center w-full px-2 py-1.5 text-sm outline-none cursor-default select-none hover:bg-accent hover:text-accent-foreground rounded-sm data-[state=open]:bg-accent">
                        <Scissors className="w-4 h-4 mr-2" />
                        Tools
                        <div className="ml-auto pl-5 text-[10px] opacity-60">▶</div>
                    </ContextMenu.SubTrigger>
                    <ContextMenu.Portal>
                        <ContextMenu.SubContent className="min-w-[180px] bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md animate-in fade-in zoom-in-95 z-[100]">
                            <Item label="Split Grid (3x3)" disabled />
                            <Item 
                                label="Quick Remove Background" 
                                onClick={onRemoveBackground} 
                                disabled={!onRemoveBackground || selectedNodeType !== 'Image'} 
                            />
                            <Item label="Upscale (2x)" disabled />
                        </ContextMenu.SubContent>
                    </ContextMenu.Portal>
                </ContextMenu.Sub>
                <ContextMenu.Separator className="h-px bg-border my-1" />
                <Item icon={<Copy className="w-4 h-4" />} label="Copy" shortcut="Ctrl+C" disabled />
                <Item icon={<Trash2 className="w-4 h-4" />} label="Delete" onClick={onDelete} shortcut="Del" intent="danger" />
            </>
        );
    }

    // Case 3: Background (Default)
    return (
        <>
            <Item icon={<FileText className="w-4 h-4" />} label="New Text Note" onClick={() => onAddNode("Text")} />
            <Item icon={<ImageIcon className="w-4 h-4" />} label="Import Image..." onClick={onImportImage} shortcut="Ctrl+I" />
            <ContextMenu.Separator className="h-px bg-border my-1" />
            <Item label="Paste" shortcut="Ctrl+V" disabled />
            <Item label="Select All" shortcut="Ctrl+A" disabled />
        </>
    );
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="h-full w-full">
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[220px] bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md animate-in fade-in zoom-in-95 z-50">
            {renderContent()}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

// Helper Item Component
const Item = ({ 
    icon, 
    label, 
    shortcut, 
    intent = 'default', 
    disabled = false,
    onClick 
}: any) => (
    <ContextMenu.Item 
        className={cn(
            "flex items-center w-full px-2 py-1.5 text-sm outline-none cursor-default select-none rounded-sm",
            disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent hover:text-accent-foreground",
            intent === 'danger' && !disabled ? "text-red-500 hover:text-red-500 hover:bg-red-500/10" : ""
        )}
        disabled={disabled}
        onSelect={onClick}
    >
        {icon && <span className="mr-2 opacity-70">{icon}</span>}
        {label}
        {shortcut && <span className="ml-auto text-xs opacity-50">{shortcut}</span>}
    </ContextMenu.Item>
);
