# Synnia Node Development Guide

## Overview

Synnia uses a **Composable Node Architecture**. Each node type is self-contained in a single file that exports three key symbols:
1.  **`config`**: Metadata for the registry (type, icon, title).
2.  **`Node`**: The React component rendered on the Canvas.
3.  **`Inspector`**: The React component rendered in the Properties Panel.
4.  **`behavior`** (Optional): Lifecycle hooks for the Graph Engine.

The system automatically discovers and registers any node file in this directory (via `index.ts` glob import).

## Quick Start Template

Copy this template to create a new node (e.g., `VideoNode.tsx`):

```tsx
import { memo } from 'react';
import { NodeProps, Position, NodeResizer } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction, NodeCollapseAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { NodeConfig } from '@/types/node-config';
import { Video, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { cn } from '@/lib/utils';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';

// 1. Configuration
export const config: NodeConfig = {
    type: NodeType.VIDEO, // Ensure this exists in NodeType enum
    title: 'Video',
    category: 'Asset',
    icon: Video,
    description: 'Video player node',
};

// 2. Behavior (Standard Collapse/Resize Logic)
export const behavior = StandardAssetBehavior;

// 3. Inspector Panel
export const Inspector = ({ assetId }: { assetId: string }) => {
    return <div className="p-4">Video Settings for {assetId}</div>;
};

// 4. Node Component
export const Node = memo((props: NodeProps<SynniaNode>) => {
    const { id, data, selected, style } = props;
    const isCollapsed = !!data.collapsed;
    const removeNode = useWorkflowStore(s => s.removeNode);
    const updateNode = useWorkflowStore(s => s.updateNode);
    
    // Check if resize is locked (e.g. inside a Rack)
    const enableResize = data.other?.enableResize !== false;

    return (
        <NodeShell 
            selected={selected} 
            className={cn("min-w-[200px]", isCollapsed ? "h-auto min-h-0" : "h-full")}
        >
            {/* Standard Resizer (Controlled by Behavior) */}
            <NodeResizer 
                isVisible={selected && !isCollapsed && enableResize} 
                minWidth={200}
                minHeight={150}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => {
                    updateNode(id, {
                        style: {
                            ...style,
                            width: params.width,
                            height: params.height,
                        },
                    });
                }}
            />

            <NodePort type="target" position={Position.Top} />
            
            <NodeHeader 
                className={cn(isCollapsed && "border-b-0 rounded-xl")}
                icon={<Video className="w-4 h-4" />}
                title={data.title || 'Video'}
                actions={
                    <>
                        <NodeCollapseAction nodeId={id} isCollapsed={isCollapsed} />
                        <NodeHeaderAction onClick={(e) => { e.stopPropagation(); removeNode(id); }} title="Delete">
                            <Trash2 className="w-4 h-4 hover:text-destructive" />
                        </NodeHeaderAction>
                    </>
                }
            />

            {/* Content Area */}
            {!isCollapsed && (
                <div className="flex-1 bg-black/10 h-full p-2 overflow-hidden">
                    {/* Your Content Here */}
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        Video Placeholder
                    </div>
                </div>
            )}

            <NodePort type="source" position={Position.Bottom} />
        </NodeShell>
    );
});
Node.displayName = 'VideoNode';
```

## Key Concepts

### 1. Behavior System
- **Always export `behavior`** if your node needs to handle Collapse/Expand or participate in Rack Layouts correctly.
- `StandardAssetBehavior` handles:
  - Toggling `collapsed` state.
  - Forcing `height: 50px` on collapse.
  - Backing up `style.height` to `data.other.expandedHeight`.
  - Restoring height on expand.

### 2. Rack Integration
- **Resize Locking**: When a node is dropped into a Rack, the `VerticalStackBehavior` sets `data.other.enableResize = false`.
- **Implementation**: Your node **MUST** respect this flag:
  ```tsx
  const enableResize = data.other?.enableResize !== false;
  // ...
  <NodeResizer isVisible={... && enableResize} />
  ```
- **Width Auto-Fit**: The Rack automatically forces your node's width to fill the container. Ensure your CSS supports flexible width (e.g., `w-full`).

### 3. Layout Primitives
Use the provided primitives in `src/components/workflow/nodes/primitives/` to ensure visual consistency:
- **`NodeShell`**: The outer container with borders, shadows, and selection states.
- **`NodeHeader`**: The standard title bar with icon and actions.
- **`NodePort`**: The connection handles (Top/Bottom/Left/Right).

### 4. Data Model
- Nodes are **Views**. Data lives in **Assets**.
- Access data using `useAsset(data.assetId)`.
- Do not store heavy content (like base64 images or long text) directly in `node.data`. Store it in the Asset.

## Registering a New Node
1. Create the file in `src/components/workflow/nodes/`.
2. Ensure `NodeType` enum (in `src/types/project.ts`) includes your new type string.
3. The Auto-Loader in `index.ts` will pick it up automatically.
