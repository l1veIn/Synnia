# Synnia Node Development Guide

## Overview

Synnia uses a **Composable Node Architecture**. Each node type is self-contained in a dedicated folder with standardized exports:

```
nodes/
├── TextNode/
│   ├── index.tsx      # Node component + config + outputs
│   └── Inspector.tsx  # Properties panel component
├── RecipeNode/
│   ├── index.tsx
│   └── Inspector.tsx
└── primitives/        # Shared UI components
    ├── NodeShell.tsx
    ├── NodeHeader.tsx
    └── NodePort.tsx
```

### Required Exports

| Export | Description |
|--------|-------------|
| `config` | Node metadata (type, icon, title, category) |
| `Node` | Canvas-rendered React component |
| `Inspector` | Properties panel component |
| `outputs` | Output handle resolvers (for data flow) |
| `behavior` | (Optional) Lifecycle hooks for Graph Engine |

## Quick Start Template

```tsx
import { memo, useEffect } from 'react';
import { NodeProps, Position, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { Video, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { NodeConfig, NodeOutputConfig } from '@/types/node-config';
import { HANDLE_IDS } from '@/types/handles';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';

// --- Output Resolvers ---
export const outputs: NodeOutputConfig = {
    'video-out': (node, asset) => {
        if (!asset?.content) return null;
        return { type: 'video', value: asset.content };
    }
};

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.VIDEO,
    title: 'Video',
    category: 'Asset',
    icon: Video,
    description: 'Video player node',
    defaultWidth: 320,
    defaultHeight: 240,
};

// --- Behavior ---
export const behavior = StandardAssetBehavior;

// --- Inspector ---
export { Inspector } from './Inspector';

// --- Node Component ---
export const Node = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const updateNodeInternals = useUpdateNodeInternals();

    // Trigger re-measure when collapsed state changes
    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    return (
        <NodeShell
            selected={selected}
            state={state.executionState}
            className={state.shellClassName}
            dockedTop={state.isDockedTop}
            dockedBottom={state.isDockedBottom}
        >
            <NodeResizer
                isVisible={selected && state.isResizable}
                minWidth={200}
                minHeight={150}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            {/* Input Handle - conditional for Output Edge */}
            {state.hasProductHandle && (
                <NodePort
                    type="target"
                    position={Position.Top}
                    id={HANDLE_IDS.INPUT}
                    className="!bg-violet-500"
                    isConnectable={true}
                />
            )}

            <NodeHeader
                className={state.headerClassName}
                icon={<Video className="h-4 w-4" />}
                title={state.title}
                actions={
                    <>
                        <NodeHeaderAction onClick={actions.toggle} title={state.isCollapsed ? 'Expand' : 'Collapse'}>
                            {state.isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </NodeHeaderAction>
                        <NodeHeaderAction onClick={(e) => { e.stopPropagation(); actions.remove(); }} title="Delete">
                            <Trash2 className="h-4 w-4 hover:text-destructive" />
                        </NodeHeaderAction>
                    </>
                }
            />

            {!state.isCollapsed && (
                <div className="p-3 flex-1 flex flex-col overflow-hidden">
                    {/* Your content here */}
                </div>
            )}

            <NodePort
                type="source"
                position={Position.Bottom}
                id="video-out"
                className="!bg-blue-400"
                isConnectable={!state.isDockedBottom}
            />
        </NodeShell>
    );
});
Node.displayName = 'VideoNode';
```

---

## Key Concepts

### 1. The `useNode` Hook

**Always use `useNode(id)` instead of accessing props directly.** It provides:

```tsx
const { state, actions } = useNode(id);

// State (read-only)
state.node           // Raw SynniaNode
state.asset          // Linked Asset data
state.title          // Display title
state.isCollapsed    // Collapse state
state.isResizable    // Can resize?
state.isDockedTop    // Part of docked chain (has master)
state.isDockedBottom // Part of docked chain (has follower)
state.isReference    // Is a shortcut/reference node?
state.executionState // 'idle' | 'running' | 'success' | 'error'
state.hasProductHandle // Is this a recipe product?
state.shellClassName // Pre-computed shell CSS classes
state.headerClassName // Pre-computed header CSS classes

// Actions (write)
actions.toggle()     // Toggle collapse
actions.remove()     // Delete node
actions.resize(w, h) // Resize node
actions.updateData(patch) // Update node.data
actions.updateContent(content) // Update asset content
```

### 2. Handle IDs

Use constants from `@/types/handles` for consistency:

```tsx
import { HANDLE_IDS } from '@/types/handles';

// Standard handles
HANDLE_IDS.INPUT      // 'input'    - Generic input (also product target)
HANDLE_IDS.TEXT_OUT   // 'text-out' - Text output
HANDLE_IDS.IMAGE_OUT  // 'image-out' - Image output
HANDLE_IDS.JSON_OUT   // 'json-out' - JSON output
HANDLE_IDS.PRODUCT    // 'product'  - Recipe product output
HANDLE_IDS.SELECTED   // 'selected' - Selector selected items
HANDLE_IDS.ROWS       // 'rows'     - Table rows
HANDLE_IDS.IMAGES     // 'images'   - Gallery images
```

### 3. Output Resolvers

Define how your node's handles output data:

```tsx
export const outputs: NodeOutputConfig = {
    [HANDLE_IDS.TEXT_OUT]: (node, asset) => {
        if (!asset?.content) return null;
        return {
            type: 'text',
            value: typeof asset.content === 'string' 
                ? asset.content 
                : asset.content.text
        };
    }
};
```

### 4. Product Handle (Output Edge)

Nodes that are **products of a recipe** display a purple input handle:

```tsx
{state.hasProductHandle && (
    <NodePort
        type="target"
        position={Position.Top}
        id={HANDLE_IDS.INPUT}
        className="!bg-violet-500"
        isConnectable={true}
    />
)}
```

The `hasProductHandle` is automatically set when:
1. Recipe execution creates a product node
2. An Output Edge connects to this node

### 5. Layout Primitives

Always use primitives from `primitives/`:

| Component | Purpose |
|-----------|---------|
| `NodeShell` | Outer container with borders, shadows, execution state |
| `NodeHeader` | Title bar with icon and action buttons |
| `NodePort` | Connection handles with consistent styling |

### 6. Data Model

- **Nodes are Views** — they render data from Assets
- **Assets are Data** — stored separately in the Asset Store
- Access asset via `state.asset` from `useNode`
- Modify asset via `actions.updateContent(newContent)`

---

## Node Types

| Type | Description | Outputs |
|------|-------------|---------|
| `TextNode` | Text/prompt content | `text-out` |
| `ImageNode` | Image content | `image-out` |
| `JSONNode` | Structured JSON data | `json-out` |
| `SelectorNode` | Option picker | `selected` |
| `TableNode` | Data table | `rows` |
| `GalleryNode` | Image gallery | `images`, `starred` |
| `QueueNode` | Task queue | `tasks`, `results` |
| `RecipeNode` | Processing unit | `product`, `reference` |

---

## Registering a New Node

1. Create folder `src/components/workflow/nodes/MyNode/`
2. Add `index.tsx` with required exports
3. Add `Inspector.tsx` for properties panel
4. Add type to `NodeType` enum in `src/types/project.ts`
5. The auto-loader in `nodes/index.ts` will pick it up automatically
