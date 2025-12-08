# Architecture V3: Composable Nodes & Graph Engine

**Date:** 2025-12-08
**Context:** The system is evolving towards a "Hybrid Flow" model where nodes (specifically Recipe Nodes) function as both data processors and data containers. This complexity has outgrown the current `BaseNodeFrame` (monolithic configuration) and `workflowStore` (mixed logic) architecture.

## 1. Feature Specification: Recipe Node V2 (Hybrid Flow)

**Concept**: A "Factory" node that consumes resources (fields) to produce a product, while also acting as a data packet itself.

**Layout Strategy (Cross-Axis):**
*   **Vertical Axis (Process/Provenance)**:
    *   **Top (Source)**: Provenance connection. Where did this recipe come from?
    *   **Bottom (Product)**: Factory output. Clicking 'Run' produces a result connected here.
        *   *Constraint*: Not user-draggable. Only system-generated connections via the 'Run' action.
*   **Horizontal Axis (Data Flow)**:
    *   **Left (Ingredients/Fields)**: **Dynamic Ports**.
        *   Rendered *inside* the node body, aligned with specific form fields.
        *   Enabled via Schema (e.g., `field.connection: { enabled: true }`).
        *   **Interaction**: Connecting a node (e.g., Image Node) here injects its Asset Data (JSON) into the field value.
    *   **Right (Reference)**: Self-reference.
        *   Allows this Recipe (as a JSON asset) to be passed as an input to another node's Left Port.

## 2. Composable Nodes (View Layer Refactor)

**Problem:**
The current `BaseNodeFrame` relies on **Configuration** (passing dozens of props like `showTopHandle`, `isBottomHandleConnectable`, `isRunDisabled`, etc.) to handle variations between Node Types. This leads to a rigid, hard-to-maintain "Configuration Hell".

**Solution: Composition over Configuration.**
Instead of a single monolithic Frame, we provide atomic UI building blocks. Each specific Node Type (`AssetNode`, `GroupNode`) composes these blocks to define its own appearance and behavior.

### Proposed Components

*   **`NodeShell`**: The visual container (border, background, selection state, resize logic). Logic-free.
*   **`NodeHeader`**: Standardized header UI (Icon, Title, Actions area). Logic-free.
*   **`NodePort`**: A wrapper around React Flow's `Handle`. Can be placed anywhere (Top, Bottom, Left, Right, Absolute).
*   **`NodeContent`**: Standard container for the node's inner view (Asset View).

### Example Implementation (Pseudo-code)

```tsx
// src/components/workflow/nodes/AssetNode.tsx

export const AssetNode = ({ id, data, selected }: NodeProps<WorkflowNode>) => {
  const isRecipe = data.type === NodeType.RECIPE;
  
  return (
    <NodeShell selected={selected} className="min-w-[240px]">
      
      {/* 1. Top Port: Input / Provenance */}
      <NodePort type="target" position={Position.Top} />

      {/* 2. Header: Composition of Actions */}
      <NodeHeader 
        icon={<FileText />} 
        title={data.title}
        actions={
           <>
             <Button onClick={handleRun} disabled={!data.agentId}>Run</Button>
             <Button onClick={handleDelete}><Trash /></Button>
           </>
        } 
      />

      {/* 3. Content: View Component */}
      <div className="p-4">
        {/* FormAssetView renders its own dynamic Left Ports for fields */}
        <FormAssetView asset={asset} nodeId={id} />
      </div>

      {/* 4. Right Port: Reference (Conditional) */}
      {isRecipe && (
        <NodePort 
            type="source" 
            position={Position.Right} 
            id="reference" 
            style={{ top: '50%' }} 
        />
      )}

      {/* 5. Bottom Port: Output / Product */}
      <NodePort 
        type="source" 
        position={Position.Bottom} 
        isConnectable={!isRecipe} // Logic handled locally
      />

    </NodeShell>
  );
};
```

---

## 3. Graph Engine (Logic Layer Refactor)

**Problem:**
`workflowStore` acts as both a **State Holder** and a **Logic Engine**. It contains complex composite logic (like `fixRackLayout`, `detachNode`, `createRackFromSelection`) mixed with atomic updates.

**Solution: Layered Architecture.**
Separate **Mechanism (Atoms)** from **Policy (Composites)**.

### Layer 1: The Store (Atomic State)
*   **Responsibility**: CRUD only. "Dumb" updates.
*   **API**: `setNodes`, `setEdges`, `updateNodeData`, `addEdge`.

### Layer 2: The Graph Engine (Composite Logic)
*   **Responsibility**: Business transactions. Enforcing consistency.
*   **Implementation**: A class or hook (`useGraphEngine`) that consumes Layer 1.
*   **API Examples**:
    *   `connectToField(source, target, fieldId)`: Validates schema, adds edge, updates node data.
    *   `collapseGroup(groupId)`: Calculates layout, updates children visibility, resizes group.

---

## 4. Implementation Plan

1.  **Phase 1: Component Decomposition**
    *   Create `NodeShell`, `NodeHeader`, `NodePort` in `src/components/workflow/nodes/primitives/`.
    *   These components will be styled copies of parts of the current `BaseNodeFrame`.

2.  **Phase 2: Recipe Node V2 (Hybrid Flow)**
    *   Implement `AssetNodeV2` (or refactor `AssetNode`) using the new primitives.
    *   Implement "Left Handle" logic inside `FormAssetView`.
    *   Implement "Right Handle" logic for Recipe Nodes.

3.  **Phase 3: Logic Migration**
    *   Establish `useGraphEngine` (or `GraphService`).
    *   Move connection validation logic (especially for field connections) there.