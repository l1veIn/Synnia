import { FormAssetContent, Asset, FieldDefinition } from '@/types/assets';
import { ScrollArea } from "@/components/ui/scroll-area";
import { NodePort } from '../primitives/NodePort';
import { Position, useHandleConnections } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface ViewProps {
    asset: Asset;
    isNodeView?: boolean;
    nodeId?: string;
}

const SimpleFieldRow = ({ field, value }: { field: FieldDefinition, value: any }) => {
     const isMissing = field.rules?.required && (value === undefined || value === '' || value === null);
     return (
        <div className="relative flex items-center justify-between gap-2 overflow-visible group min-h-[20px]">
            <span className={cn("shrink-0 max-w-[80px] truncate", isMissing ? 'text-destructive font-bold' : 'text-muted-foreground')} title={field.label || field.key}>
                {field.label || field.key}:
            </span>
            <span className="text-foreground truncate font-medium bg-muted/50 px-1.5 py-0.5 rounded max-w-[120px]" title={String(value)}>
                {value === undefined || value === '' ? <span className="text-muted-foreground/50">-</span> : String(value)}
            </span>
        </div>
     );
}

const NodeFieldRow = ({ field, value, nodeId }: { field: FieldDefinition, value: any, nodeId?: string }) => {
    // This hook is safe here because this component is only rendered inside React Flow context
    const connections = useHandleConnections({
        type: 'target',
        id: field.key,
        nodeId
    });
    const isConnected = connections.length > 0;
    const isMissing = field.rules?.required && (value === undefined || value === '' || value === null);

    return (
        <div className="relative flex items-center justify-between gap-2 overflow-visible group min-h-[20px]">
             {field.connection?.enabled && (
                <NodePort 
                    type="target"
                    position={Position.Left}
                    id={field.key}
                    className={cn("-left-5 top-1/2 -translate-y-1/2", isConnected && "!bg-blue-500 !border-blue-500")}
                />
            )}
            
            <span className={cn("shrink-0 max-w-[80px] truncate", isMissing && !isConnected ? 'text-destructive font-bold' : 'text-muted-foreground')} title={field.label || field.key}>
                {field.label || field.key}:
            </span>

            {isConnected ? (
                 <span className="text-blue-500 text-[10px] italic font-medium truncate max-w-[120px] flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Linked
                </span>
            ) : (
                <span className="text-foreground truncate font-medium bg-muted/50 px-1.5 py-0.5 rounded max-w-[120px]" title={String(value)}>
                    {value === undefined || value === '' ? <span className="text-muted-foreground/50">-</span> : String(value)}
                </span>
            )}
        </div>
    );
}

export function FormAssetView({ asset, isNodeView, nodeId }: ViewProps) {
    const content = asset.content as FormAssetContent;
    const { schema, values } = content;
    
    if (!schema || schema.length === 0) {
        return (
            <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                <span className="mb-1">Empty Form</span>
                <span className="text-[9px] opacity-70">Use Inspector to add fields</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full text-xs font-mono">
             <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between">
                <span>{asset.metadata.name || 'Parameters'}</span>
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold">FORM</span>
             </div>
             
             <ScrollArea className="flex-1 w-full -mr-2 pr-2">
                <div className="space-y-1.5 pb-2 pl-2">
                    {schema.map(field => {
                        const val = values[field.key];
                        if (isNodeView) {
                            return <NodeFieldRow key={field.id} field={field} value={val} nodeId={nodeId} />;
                        }
                        return <SimpleFieldRow key={field.id} field={field} value={val} />;
                    })}
                </div>
             </ScrollArea>
        </div>
    );
}