# Phase 6 最小清理清单（路径导向）

> 目标：清除 legacy 依赖，收束到 95%+ 理想结构。
> 约束：**不改持久化层（SQLite 暂保）**

## 1) assetId 依赖清理
- `src/core/engine/AssetSystem.ts`
  - 标记为 legacy 兼容层或替换为 Node Repository 投影
- `src/hooks/useNode.ts`
  - 移除对 `node.data.assetId` 的硬依赖，统一走解析器
- `src/components/workflow/*`
  - 所有 `node.data.assetId` 改为 `resolveNodeAssetId`

## 2) Engine / Features 退役
- `src/core/engine/*`
  - 保留 UI 交互相关，业务逻辑迁出后删除多余方法
- `src/features/*`
  - 领域逻辑迁入 `domain/` / `application/`

## 3) assets store 降级为投影
- `src/store/workflowStore.ts`
  - assets 作为 projection（只读）
  - 主数据源是 Node + File

## 4) 持久化保持现状
- `src-tauri/src/infrastructure/database.rs`
  - 暂不改动
- `src-tauri/src/features/project/persistence.rs`
  - 保持 SQLite 路径

## 5) presentation 归位
- `src/hooks/*` 只保留 UI hooks
- `src/components/*` 仅 UI
- `src/pages/*` 仅 UI
