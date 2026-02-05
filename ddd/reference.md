# 参考手册（Agent 快速入门）

> 本文档为新接手 agent 提供关键代码参考，避免反复查找。

---

## 1. Domain 模型

### Node（核心实体）
> 路径：`domain/node/Node.ts`

```typescript
interface Node {
    id: string;
    type: string;                    // 节点类型（如 'text', 'recipe:xxx'）
    valueType: 'record' | 'array';   // 数据结构类型
    data: any;                       // 业务数据（原 Asset.value）
    schema?: NodeSchema;             // 字段定义
    meta: NodeMeta;                  // 名称、时间戳、系统信息
    presentation: NodePresentation;  // 位置、样式、展开状态
    fileIds?: string[];              // 关联的 File 聚合 ID
    executionState?: NodeExecutionState;  // 执行状态
    errorMessage?: string;
}

type NodeExecutionState = 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale';
```

### NodePresentation（展示态 VO）
> 路径：`domain/node/NodePresentation.ts`

```typescript
interface NodePresentation {
    layout: { collapsed?: boolean };
    expanded: Record<string, boolean>;
    size: { width?: number; height?: number };
    style: Record<string, string | number>;
    visibility: { hidden?: boolean };
    ui: Record<string, any>;
}
```

### NodeMeta（元信息 VO）
> 路径：`domain/node/NodeMeta.ts`

```typescript
interface NodeMeta {
    sys: { name?: string; createdAt?: number; updatedAt?: number };
    valueMeta: Record<string, any>;
    ui: Record<string, any>;
    ext: Record<string, any>;
}
```

---

## 2. Use Case 接口

### updateNodeUseCase
> 路径：`application/use-cases/update-node/index.ts`

```typescript
type UpdateNodeInput = {
    id: string;
    legacyNode?: SynniaNode;         // 可选：直接传入老节点
    legacyPatch?: Partial<SynniaNode>;  // 兼容模式：直接 patch
    presentation?: Partial<NodePresentation>;
    execution?: { state?: NodeExecutionState; errorMessage?: string };
    meta?: Partial<NodeMeta>;
    data?: any;                      // 业务数据更新
    schema?: any;
    reference?: { isReference?: boolean; originalNodeId?: string };
};

type UpdateNodeDeps = {
    getNodes: () => SynniaNode[];
    getAssets: () => Record<string, Asset>;
    now?: () => number;
};

function updateNodeUseCase(input: UpdateNodeInput, deps: UpdateNodeDeps): SynniaNode | null;
```

### 其他 Use Cases
| Use Case | 路径 | 用途 |
|----------|------|------|
| `createNodeUseCase` | `application/use-cases/create-node/` | 创建新节点 |
| `updateNodePresentationUseCase` | `application/use-cases/update-node-presentation/` | 仅更新展示态 |
| `updateNodeExecutionUseCase` | `application/use-cases/update-node-execution/` | 仅更新执行状态 |
| `runRecipeUseCase` | `application/use-cases/run-recipe/` | 运行配方 |
| `importFileUseCase` | `application/use-cases/import-file/` | 导入文件 |

---

## 3. 迁移示例

### Before（直接操作 Asset）
```typescript
// TextNode/behavior.ts - 旧模式
import type { Asset } from '@/domain/asset/types';

const value = asset?.value as Record<string, any>;
const content = value?.content ?? '';
```

### After（使用 Domain Node）
```typescript
// TextNode/behavior.ts - 目标模式
import type { Node } from '@/domain/node/Node';

const content = node.data?.content ?? '';
```

### Behavior 调用 Use Case
```typescript
// 旧模式：直接调用 assetSystem
assetSystem.update(nodeId, { value: newValue });

// 新模式：调用 Use Case
import { updateNodeUseCase } from '@/application/use-cases/update-node';

const updatedNode = updateNodeUseCase(
    { id: nodeId, data: newValue },
    { getNodes, getAssets }
);
graphMutator.updateNode(updatedNode);
```

---

## 4. 兼容层（待移除）

| 文件 | 作用 | 移除条件 |
|------|------|----------|
| `application/adapters/nodeProjection.ts` | Node ↔ SynniaNode 转换 | 所有调用方使用 Domain Node |
| `presentation/engine/AssetSystem.ts` | Asset CRUD 封装 | 所有调用方使用 Use Cases |
| `domain/asset/types.ts` | Legacy Asset 类型 | 所有引用更新为 Node |
