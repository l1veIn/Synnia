# Phase 2 提示词（Node 模型迁移）

## 总体目标
- 建立稳定的 Node=Asset 核心领域模型
- 引入 Presentation VO 与执行状态字段
- 统一 Node 创建/更新入口

## 已完成内容（Phase 0-1）
- Phase 0: 已建立 DDD 分层目录骨架
- Phase 1: 完成 ValueMappingService 迁移并统一调用

## Phase 2 目标
- Node=Asset 合并为领域实体
- 引入 `presentation` VO
- 执行状态字段持久化（executionState/errorMessage/stateUpdatedAt）
- 逐步将 Node 创建/更新逻辑收敛到 Application

> 参考文档：
> - [DDD_V1_4_5.md](ddd/DDD_V1_4_5.md)
> - [DDD_V1_6_Context_and_Mapping.md](ddd/DDD_V1_6_Context_and_Mapping.md)
> - [DDD_V1_7_Migration_Plan.md](ddd/DDD_V1_7_Migration_Plan.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 A：Node 领域模型定义
你是领域建模工程师。
任务：根据现有 `src/types/project.ts` 与 `src/types/assets.ts` 定义 Node=Asset 领域模型。
要求：
1. 产出字段映射表（旧 -> 新）
2. 标注哪些字段进入 `presentation` VO
3. 标注执行状态字段的来源与用途
输出：字段对齐表 + 风险点

## 任务 B：Presentation VO 拆分
你是架构迁移工程师。
任务：设计 `NodePresentation` VO 的结构与最小字段集合。
要求：
1. 覆盖 position/size/style/layout/docked/expanded
2. 不引入 UI 依赖
输出：VO 字段列表 + 结构草图

## 任务 C：Node 创建/更新入口梳理
你是应用层工程师。
任务：列出 Node 创建/更新的调用入口。
要求：
1. 找出 GraphEngine/GraphMutator 及 hooks 中的入口
2. 提出 Application Use Case 的接口建议
输出：入口清单 + UseCase 草案

## 任务 D：兼容层策略
你是迁移策略工程师。
任务：设计旧结构与新 Node 结构的兼容策略（临时适配层）。
要求：
1. 识别必须保留的兼容接口
2. 识别可逐步弃用的字段/方法
输出：兼容清单 + 弃用建议
