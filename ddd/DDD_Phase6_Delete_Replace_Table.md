# Phase 6 逐文件删除/替换建议表

> 说明：按文件路径给出最小清理建议。

| 路径 | 建议 | 理由 |
|---|---|---|
| src/core/engine/AssetSystem.ts | 标记 legacy 或删除 | Node=Asset 已合并，AssetSystem 仅做投影 |
| src/core/engine/GraphEngine.ts | 缩减为 UI-only | 业务逻辑迁到 UseCase |
| src/core/engine/GraphMutator.ts | 缩减为 UI-only | Create/Update 已迁入 UseCase |
| src/hooks/useRunRecipe.ts | 保留 UI 协调 | 业务逻辑已进 RunRecipeUseCase |
| src/lib/importHeavyNode.ts | 保留 facade | 但不再包含业务逻辑 |
| src/types/assets.ts | 标记 legacy | 迁移到 domain/node |
| src/types/project.ts | 标记 legacy | 迁移到 domain/node + presentation |
| src/store/workflowStore.ts | 投影层 | assets 为只读投影 |
| src/features/recipes/* | 迁移逻辑到 domain/application | UI 层保留 |
| src/features/models/* | 迁移为 infra adapter | Provider 逻辑不应在 feature |
| src-tauri/src/infrastructure/database.rs | deprecated | SQLite 退役 |
| src-tauri/src/features/project/persistence.rs | debug-only | SurrealDB 已取代 |
