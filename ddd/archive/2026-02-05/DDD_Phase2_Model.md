# Phase 2 产出（领域模型与字段对齐）

> 来源：ddd/phase2.md
> 目的：固化 Node=Asset 的领域模型与字段对齐设计。

## 字段对齐表（旧 → 新）

| 旧位置 | 旧字段 | 新 Node 字段 | 说明 / 去向 |
|---|---|---|---|
| `src/types/project.ts` | `SynniaNode.id` | `Node.id` | 主键不变 |
| `src/types/project.ts` | `SynniaNode.type` | `Node.type` | 领域类型 |
| `src/types/assets.ts` | `Asset.valueType` | `Node.valueType` | record/array 分支 |
| `src/types/assets.ts` | `Asset.value` | `Node.data` | 核心数据 |
| `src/types/assets.ts` | `Asset.config.schema` | `Node.schema` | 字段定义 |
| `src/types/assets.ts` | `Asset.valueMeta` | `Node.meta.valueMeta` | 预览/尺寸 |
| `src/types/assets.ts` | `Asset.sys` | `Node.meta.sys` | name/createdAt/updatedAt/source/isLibraryAsset |
| `src/types/project.ts` | `BaseNodeData.title` | `Node.meta.sys.name` | 避免双写 |
| `src/types/project.ts` | `BaseNodeData.icon/label` | `Node.meta.ui?` | UI-only 或投影 |
| `src/types/project.ts` | `BaseNodeData.assetId` | 删除 | Node.id 即 assetId |
| `src/types/project.ts` | `BaseNodeData.isReference` | `Node.isReference` | 保留引用语义 |
| `src/types/project.ts` | `BaseNodeData.originalNodeId` | `Node.originalNodeId` | 引用指向 |
| `src/types/project.ts` | `BaseNodeData.hasProductHandle` | `Node.presentation.ui.hasProductHandle?` | UI 投影 |
| `src/types/project.ts` | `BaseNodeData.layoutMode` | `Node.presentation.layout.mode` | Presentation VO |
| `src/types/project.ts` | `BaseNodeData.dockedTo` | `Node.presentation.layout.dockedTo` | Presentation VO |
| `src/types/project.ts` | `BaseNodeData.collapsed` | `Node.presentation.expanded.collapsed` | Presentation VO |
| `src/types/project.ts` | `BaseNodeData.expandedWidth/expandedHeight` | `Node.presentation.expanded.*` | Presentation VO |
| `src/types/project.ts` | `BaseNodeData.originalPosition` | `Node.presentation.expanded.originalPosition` | Presentation VO |
| `SynniaNode.position` | `position` | `Node.presentation.position` | Presentation VO |
| `SynniaNode.width/height` | `width/height` | `Node.presentation.size.*` | Presentation VO |
| `SynniaNode.style` | `style` | `Node.presentation.style` | Presentation VO |
| `SynniaNode.hidden` | `hidden` | `Node.presentation.visibility.hidden` | 若需持久化 |
| `SynniaNode.parentId` | `parentId` | `Node.presentation.layout.parentId?` | 容器语义 |
| `src/types/project.ts` | `BaseNodeData.state` | `Node.executionState` | 迁出 data |
| `src/types/project.ts` | `BaseNodeData.errorMessage` | `Node.errorMessage` | 迁出 data |
| 新增 | — | `Node.stateUpdatedAt` | 状态更新时间 |

## 执行状态字段
- 来源：`BaseNodeData.state`, `BaseNodeData.errorMessage`
- 用途：UI 展示执行状态与中断提示
- 新增：`stateUpdatedAt`，状态变更时写入

## 风险点
- `assetId` 与 `Node.id` 合并影响 `graphEngine.assets` 相关路径。
- `title` 与 `Asset.sys.name` 双写需收敛为单一权威源。
- `Asset.config.schema` 与其他 schema 来源存在混用风险。
- `BaseNodeData.other` 的隐式字段需显式化到 Presentation VO。

## NodePresentation VO（最小集合）

```ts
type NodePresentation = {
  position: { x: number; y: number };
  size?: { width?: number; height?: number };
  style?: Record<string, string | number>;
  layout?: {
    mode?: 'free' | 'rack' | 'list' | 'grid';
    dockedTo?: string | null;
    parentId?: string | null;
  };
  expanded?: {
    collapsed: boolean;
    expandedWidth?: number;
    expandedHeight?: number;
    originalPosition?: { x: number; y: number };
  };
  visibility?: { hidden?: boolean };
};
```
