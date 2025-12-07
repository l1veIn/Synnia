# Synnia Architecture Refactor v2: Asset-Centric Model

**Date:** 2025-12-07
**Objective:** Decouple "View (Nodes)" from "Data (Assets)" to enable Single Source of Truth, Shortcuts, and future Scalability.

## 1. Core Philosophy
- **Separation of Concerns:** 
  - `WorkflowStore` handles Topology (Graph, Layout, Selection).
  - `AssetStore` handles Content (Text, Image Data, file references).
- **Reference Model:**
  - Nodes are lightweight pointers.
  - Multiple nodes can point to the same `assetId`.
  - "Shortcut" nodes are read-only references.

## 2. Architecture Critique & Solutions (from Review)
- **Lifecycle Management:** 
  - **Risk:** Dangling assets (orphaned data) leading to memory leaks.
  - **Decision:** Adopt "File System Mode". Assets persist until explicitly deleted or via "Clean Unused" action. Assets are First-Class Citizens.
- **Performance:**
  - **Risk:** Typing in a node triggering global store updates/re-renders.
  - **Decision:** Cold/Hot separation.
    - Components use local state for editing.
    - Commit to Global Store only on `blur` or `debounce`.
- **Consistency:**
  - **Risk:** Ambiguity in editing shared assets.
  - **Decision:** Shared assets are Read-Only by default in Shortcut nodes. Explicit "Detach/Fork" action required to modify independently.

## 3. Data Structure Definitions

### The Asset
```typescript
export type AssetType = 'text' | 'image' | 'json' | 'script';

export interface Asset {
  id: string;
  type: AssetType;
  mimeType?: string; // e.g. 'text/markdown', 'image/png'
  content: any; // The heavy payload
  metadata: {
    createdAt: number;
    updatedAt: number;
    name: string; // Internal name/label
    source?: string;
  };
}
```

### The Node (Slimmed Down)
```typescript
interface SynniaNodeData {
  title: string; // View-specific title (can differ from asset name)
  collapsed: boolean;
  
  // Data Linkage
  assetId?: string; // Pointer to AssetStore
  
  // View State
  isReference?: boolean; // If true, render in Read-Only Shortcut mode
  originalNodeId?: string; // For "Jump to Original" navigation
  
  // Layout Strategy
  layoutMode?: 'free' | 'rack' | 'list'; // Replacing hardcoded Group logic
}
```

## 4. Implementation Plan

### Phase 1: Data Layer Refactor (Current Focus)
- [ ] Update `types/project.ts` and `types/assets.ts` to include `Asset` definitions and updated `SynniaNodeData`.
- [ ] Modify `WorkflowStore` to include `assets: Record<string, Asset>`.
- [ ] Implement helper actions: `createAsset`, `updateAsset`, `getAsset`.
- [ ] Migrate `addNode` to create an Asset first, then link it.
- [ ] Create `useAsset` hook for components.

### Phase 2: Atomic Components
- [ ] Split `AssetNode` into `TextNode`, `ImageNode`, etc.
- [ ] Update Registry.

### Phase 3: Shortcuts & Interaction
- [ ] Implement "Paste as Shortcut".
- [ ] Implement "Detach" (Copy-on-Write).
- [ ] Add visual indicators for Shortcuts.

### Phase 4: Container Strategy
- [ ] Abstract Drag&Drop logic into `ContainerRegistry`.
