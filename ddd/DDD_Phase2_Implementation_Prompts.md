# Phase 2 实施提示词（可直接分发）

> 参考文档：
> - [DDD_Phase2_Model.md](ddd/DDD_Phase2_Model.md)
> - [DDD_Phase2_Migration.md](ddd/DDD_Phase2_Migration.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 1：创建 Node 领域模型
你是领域模型工程师。
任务：新增 Node 领域模型文件。
要求：
- 创建 `src/domain/node/Node.ts`、`NodePresentation.ts`、`NodeMeta.ts`、`NodeSchema.ts`
- 字段以 Phase2 模型为准
- 不引入 React/Store/Tauri
输出：文件列表 + 主要结构

## 任务 2：投影适配层
你是应用层工程师。
任务：建立旧结构与新 Node 结构的投影适配。
要求：
- 新增 `src/application/adapters/nodeProjection.ts`
- 提供 `toLegacySynniaNode` 与 `fromLegacy`
- 保持 UI/ReactFlow 渲染不变
输出：适配函数签名 + 关键字段映射

## 任务 3：Create/Update 用例
你是用例设计工程师。
任务：添加 Node 创建/更新用例。
要求：
- 新增 use-case 目录与入口函数
- GraphEngine/GraphMutator 逐步改为调用用例
输出：用例接口 + 替换点清单

## 任务 4：执行状态迁移
你是状态迁移工程师。
任务：将执行状态字段迁移至 Node 模型并保证持久化。
要求：
- 引入 `executionState`, `errorMessage`, `stateUpdatedAt`
- 更新 `useRunRecipe` 或集中在 Use Case
输出：变更文件清单 + 风险点

## 任务 5：AssetSystem 兼容层
你是兼容性工程师。
任务：保留 AssetSystem API，但内部映射到 Node 结构。
要求：
- 不破坏现有调用
- 标注待弃用接口
输出：适配策略说明 + 代码改动点
