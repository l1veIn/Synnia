# Phase 6 提示词（清理与收束）

## 总体目标
- 清理 legacy 依赖
- 收束到 domain/application/infrastructure/presentation 四层
- **不改持久化层（SQLite 暂时保留）**

## 背景约束
- Phase5 已跳过/延期
- 当前阶段不做 DB schema/引擎迁移

## 任务 A：资产依赖清理
你是迁移工程师。
任务：清理 `node.data.assetId` 依赖。
要求：
- 改用 `resolveNodeAssetId`
- 资产只作为投影
输出：替换清单 + 风险点

## 任务 B：Engine 瘦身
你是架构工程师。
任务：将 `core/engine` 只保留 UI 操作。
要求：
- 删除业务逻辑
- 业务逻辑迁移到 UseCase
输出：删改清单 + 替代路径

## 任务 C：features 迁移
你是迁移工程师。
任务：清理 `features/*` 中的领域逻辑。
要求：
- 迁移到 domain/application
- features 只保留 UI
输出：迁移清单

## 任务 D：持久化保持现状
你是后端工程师。
任务：确认 SQLite 投影持久化路径仍可用。
要求：
- 不修改数据库结构
- 如有 Surreal/HTTP 通道，保持禁用或隔离
输出：现状确认清单
