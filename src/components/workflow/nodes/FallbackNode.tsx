import { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { AlertCircle } from 'lucide-react';

export const FallbackNode = memo(({ id, data, selected, type }: NodeProps<any>) => (
    <NodeShell selected={selected} state="error" className="min-w-[150px]">
        <NodePort type="target" position={Position.Top} />
        <NodeHeader icon={<AlertCircle className="text-destructive h-4 w-4"/>} title={data.title || "Unknown Type"} />
        <div className="p-3 text-xs text-muted-foreground">
            Node Type: <span className="font-mono font-bold">{type}</span><br/>
            ID: <span className="font-mono">{id.slice(0,8)}...</span>
        </div>
        <NodePort type="source" position={Position.Bottom} />
    </NodeShell>
));
FallbackNode.displayName = 'FallbackNode';
