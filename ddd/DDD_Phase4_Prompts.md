# Phase 4 提示词（Execution / Recipe 迁移）

## 总体目标
- Recipe 定义迁移到 Domain
- ExecutionRun 作为日志实体
- RunRecipeUseCase 统一入口
- 减少 UI/Hook 直接写执行状态

## 已完成内容（Phase 0-3）
- Phase 0: DDD 目录骨架
- Phase 1: ValueMappingService
- Phase 2: Node 领域模型 + Use Cases + 投影
- Phase 3: File 聚合 + Ingestion + ImportFileUseCase

## Phase 4 目标
- Recipe/Execution 领域模型落地
- RunRecipeUseCase 统一执行
- 执行状态更新由 UseCase 负责

> 参考文档：
> - [DDD_V1_4_5.md](ddd/DDD_V1_4_5.md)
> - [DDD_Phase2_Model.md](ddd/DDD_Phase2_Model.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 A：Recipe 领域模型
你是领域建模工程师。
任务：将 Recipe 定义迁移到 Domain。
要求：
- 新增 `src/domain/recipe/Recipe.ts`
- 仅保留核心字段（id/name/description/category/inputSchema/manifest）
输出：字段表 + 与现有 types 对齐说明

## 任务 B：ExecutionRun 实体
你是领域建模工程师。
任务：建立 ExecutionRun 实体。
要求：
- 新增 `src/domain/recipe/ExecutionRun.ts`
- 包含 runId/recipeId/inputNodeId/outputNodeId/state/logs
输出：实体结构 + 状态机说明

## 任务 C：RunRecipeUseCase
你是应用层工程师。
任务：建立统一 RunRecipeUseCase。
要求：
- 新增 `src/application/use-cases/run-recipe/`
- 统一执行、日志、状态更新
- UI/Hook 只调用 UseCase
输出：UseCase 接口 + 替换点清单

## 任务 D：清理 useRunRecipe
你是迁移工程师。
任务：缩减 `useRunRecipe` 的业务逻辑。
要求：
- 只保留 UI 协调与 toast
- 调用 RunRecipeUseCase
输出：变更文件清单 + 风险点
