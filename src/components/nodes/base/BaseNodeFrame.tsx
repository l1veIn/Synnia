import { ReactNode, useState, useCallback } from 'react';
import { Handle, Position, NodeResizer, ResizeParams } from '@xyflow/react';
import { Card, CardHeader } from '@/components/ui/card';
import { Link as LinkIcon, CornerUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UIAssetNodeData } from '../AssetNode';
import { motion } from 'framer-motion';
import { useProjectStore } from '@/store/projectStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface InputHandleConfig {
    id: string;
    label?: string;
    color?: string;
}

interface BaseNodeFrameProps {
    id: string;
    selected?: boolean;
    dragging?: boolean; // Local dragging
    data: UIAssetNodeData;
    icon: ReactNode;
    label: string;
    statusIndicator: string;
    borderClass: string;
    isBrokenLink?: boolean;
    onResizeStart?: () => void;
    onResizeEnd?: (event: any, params: ResizeParams) => void;
    onHeaderDoubleClick?: (event: React.MouseEvent) => void;
    showInputHandle?: boolean; // Legacy/Single
    inputHandles?: InputHandleConfig[]; // Multi-handle support
    children: ReactNode;
}

export function BaseNodeFrame({
    selected,
    dragging,
    data,
    icon,
    label,
    statusIndicator,
    borderClass,
    isBrokenLink,
    onResizeStart,
    onResizeEnd,
    onHeaderDoubleClick,
    showInputHandle = false,
    inputHandles,
    children
}: BaseNodeFrameProps) {
    const [isResizing, setIsResizing] = useState(false);
    const isGlobalDragging = useProjectStore(state => state.isGlobalDragging);

    const handleResizeStart = useCallback(() => {
        setIsResizing(true);
        onResizeStart?.();
    }, [onResizeStart]);

    const handleResizeEnd = useCallback((event: any, params: ResizeParams) => {
        setIsResizing(false);
        onResizeEnd?.(event, params);
    }, [onResizeEnd]);

    const isCollection = data.assetType === 'collection_asset';
    const isCollapsed = data.properties?.collapsed !== false; 

    return (
        <motion.div 
            // Disable layout animation during ANY drag (local or global) OR resize
            layout={!dragging && !isGlobalDragging && !isResizing} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "relative group h-full w-full", 
                selected ? "z-50" : "z-0"
            )}
        >
            <NodeResizer 
                color="#3b82f6" 
                isVisible={!!selected} 
                minWidth={160} 
                minHeight={100} 
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
            />

            {inputHandles && inputHandles.length > 0 ? (
                inputHandles.map((handle, index) => {
                    const topPercent = ((index + 1) * 100) / (inputHandles.length + 1);
                    return (
                        <TooltipProvider key={handle.id} delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Handle 
                                        id={handle.id}
                                        type="target" 
                                        position={Position.Left} 
                                        style={{ 
                                            top: `${topPercent}%`,
                                            background: handle.color || 'var(--muted-foreground)' 
                                        }}
                                        className="w-3 h-3 border-2 border-background transition-transform hover:scale-125" 
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs px-2 py-1">
                                    {handle.label}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })
            ) : showInputHandle && (
                <Handle type="target" position={Position.Left} className="w-3 h-3 bg-muted-foreground border-2 border-background" />
            )}

            <Card className={cn(
                "h-full w-full overflow-hidden shadow-sm flex flex-col transition-all duration-300 backdrop-blur-md",
                // Glassmorphism & Border Logic
                "bg-card/80 border border-border/40", 
                selected ? "ring-2 ring-primary/20 shadow-xl translate-y-[-2px]" : "hover:shadow-md hover:border-border/60",
                borderClass,
                data.assetType === 'reference_asset' ? "opacity-90" : "" 
            )}>
                {/* Header */}
                <CardHeader 
                    className="p-2 flex flex-row items-center justify-between space-y-0 border-b border-border/10 bg-muted/30 shrink-0 h-10 cursor-pointer"
                    onDoubleClick={onHeaderDoubleClick}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className={cn("w-2 h-2 rounded-full shrink-0 transition-colors shadow-[0_0_8px_rgba(0,0,0,0.2)]", statusIndicator)} />
                        <div className="text-muted-foreground shrink-0 opacity-70">
                            {isBrokenLink ? <LinkIcon className="w-4 h-4 text-destructive" /> : icon}
                        </div>
                        <span className="text-xs font-semibold truncate text-foreground/80">
                            {isBrokenLink ? "Broken Reference" : label}
                        </span>
                    </div>
                    {/* Shortcut Indicator Icon */}
                    {data.assetType === 'reference_asset' && (
                        <CornerUpRight className="w-3 h-3 text-blue-500" />
                    )}
                </CardHeader>

                {/* Content Area */}
                <div className="flex-1 min-h-0 relative flex flex-col bg-background/20">
                    {children}
                </div>
            </Card>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
        </motion.div>
    );
}