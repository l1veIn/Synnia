# Phase 2 产出（入口清单与兼容策略）

> 来源：ddd/phase2.md
> 目的：固化 Node 创建/更新入口清单与兼容层策略。

## Node 创建入口（现状）
- `GraphMutator.createSmart` / `createSmartBatch` (`src/core/engine/GraphMutator.ts`)
- `useCanvasLogic.handleAddNode` → `graphEngine.mutator.createSmart` (`src/hooks/useCanvasLogic.ts`)
- `importHeavyNode` → `graphEngine.mutator.createSmart` (`src/lib/importHeavyNode.ts`)
- `useFileUploadDrag.onDrop` → `graphEngine.mutator.createSmart` (`src/hooks/useFileUploadDrag.ts`)
- `useRunRecipe` → `graphEngine.mutator.createSmartBatch` (`src/hooks/useRunRecipe.ts`)
- `useGlobalShortcuts` → `mutator.duplicateNode/pasteNodes` (`src/hooks/useGlobalShortcuts.ts`)

## Node 更新入口（现状）
- `GraphEngine.updateNode/updateNodes/applyPatches` (`src/core/engine/GraphEngine.ts`)
- `InteractionSystem` 拖拽/布局更新 (`src/core/engine/InteractionSystem.ts`)
- `useNode` actions → `graphEngine.updateNode` (`src/hooks/useNode.ts`)
- `useRunRecipe` 执行状态更新 (`src/hooks/useRunRecipe.ts`)
- `AssetSystem.update/updateConfig/updateSys` (`src/core/engine/AssetSystem.ts`)

## Use Case 草案（接口建议）

```ts
type CreateNodeInput = {
  type: string;
  data?: any;
  schema?: FieldDefinition[];
  valueType?: 'record' | 'array';
  meta?: {
    sys?: { name?: string; source?: string; isLibraryAsset?: boolean | null };
    valueMeta?: { preview?: string; width?: number; height?: number; length?: number };
  };
  presentation?: NodePresentation;
  reference?: { isReference: boolean; originalNodeId?: string };
  connections?: { outputFrom?: string; connectFrom?: { nodeId: string; handle: string } };
};

type CreateNodeUseCase = (input: CreateNodeInput) => Promise<Node>;

type UpdateNodeInput = {
  id: string;
  data?: any;
  schema?: FieldDefinition[];
  meta?: Partial<NodeMeta>;
  presentation?: Partial<NodePresentation>;
  execution?: { state?: NodeExecutionState; errorMessage?: string };
};

type UpdateNodeUseCase = (input: UpdateNodeInput) => Promise<Node>;

type UpdateNodePresentationUseCase = (id: string, patch: Partial<NodePresentation>) => Promise<Node>;

type UpdateNodeExecutionStateUseCase = (id: string, state: NodeExecutionState, errorMessage?: string) => Promise<Node>;
```

## 兼容层策略（过渡期）
- 双向投影
  - `toLegacySynniaNode(Node) -> SynniaNode` 用于 UI/ReactFlow
  - `fromLegacy(SynniaNode, assets) -> Node` 用于导入旧数据
- 资产兼容门面
  - 临时保留 `assets` store，但实现为 Node 视图投影
  - `AssetSystem` 作为 `NodeRepository` 的薄包装
- GraphEngine 继续存在
  - 依旧接收 `updateNode`/`setNodes`
  - 内部调用 Application Use Case 后回写投影

## 必须保留的兼容接口
- `graphEngine.updateNode/updateNodes`
- `graphEngine.mutator.createSmart/createSmartBatch`
- `AssetSystem.update/updateConfig/updateSys`
- `importHeavyNode`
- `useRunRecipe` 对执行状态写入

## 逐步弃用字段/方法
- `BaseNodeData.assetId`
- `BaseNodeData.title`
- `BaseNodeData.state/errorMessage`
- `BaseNodeData.other`
- `Asset.config.extra`
