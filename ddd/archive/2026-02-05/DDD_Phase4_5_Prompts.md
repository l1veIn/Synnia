# Phase 4.5 提示词（兼容层清理）

## 总体目标
- 收敛 legacy 兼容层
- 减少 assetId / assets 的依赖
- UI 只依赖 Node + fileIds

## 已完成内容（Phase 0-4）
- Phase 0: DDD 目录骨架
- Phase 1: ValueMappingService
- Phase 2: Node 模型 + Use Cases
- Phase 3: File 聚合 + Ingestion
- Phase 4: Recipe/Execution 迁移

## Phase 4.5 目标
- 逐步移除对 `AssetSystem` 的强依赖
- `assets` store 转为投影层或只读缓存
- `BaseNodeData.assetId` 弃用

> 参考文档：
> - [DDD_Phase2_Model.md](ddd/DDD_Phase2_Model.md)
> - [DDD_Phase2_Migration.md](ddd/DDD_Phase2_Migration.md)
> - [DDD_Phase3_Implementation_Checklist.md](ddd/DDD_Phase3_Implementation_Checklist.md)

## 任务 A：识别 legacy 依赖
你是迁移审计员。
任务：扫描对 `assets` / `AssetSystem` / `assetId` 的核心依赖。
输出：文件清单 + 风险说明

## 任务 B：收敛资产投影
你是兼容层工程师。
任务：将 `assets` store 转为 Node 投影或只读缓存。
要求：
- 不破坏 UI 使用
- 标注待弃用入口
输出：适配策略

## 任务 C：字段替换
你是迁移工程师。
任务：将 `BaseNodeData.assetId` 使用替换为 Node.id 或 Node.fileIds。
输出：替换清单 + 风险
