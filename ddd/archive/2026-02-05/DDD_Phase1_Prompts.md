# Phase 1 提示词（Value Mapping 迁移）

## 总体目标
- 建立稳定的 DDD 分层与领域模型基线
- 在不破坏功能的前提下逐步迁移

## 已完成内容（Phase 0）
- main 已同步并创建分支 `codex/ddd-migration`
- 新增 DDD 分层骨架目录：`src/domain/` `src/application/` `src/infrastructure/` `src/presentation/`
- 固化 DDD 结晶文档与目标目录结构

## Phase 1 目标
- 将 `smartResolve` 迁移为领域服务（ValueMappingService）
- 统一 Value Edge 调用路径
- 行为保持一致

> 参考文档：
> - [DDD_V1_4_5.md](ddd/DDD_V1_4_5.md)
> - [DDD_V1_6_Context_and_Mapping.md](ddd/DDD_V1_6_Context_and_Mapping.md)
> - [DDD_V1_7_Migration_Plan.md](ddd/DDD_V1_7_Migration_Plan.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 A：抽 ValueMappingService
你是一个 DDD 迁移工程师。
任务：将 smartResolve.ts 抽离为 domain 服务。
要求：
1. 新建 src/domain/edge/ValueMappingService.ts
2. 保持 smartResolve API 行为一致
3. 原引用点改为使用新服务（不改功能）
4. domain 不依赖 React/Store/Tauri
输出：修改文件列表 + 主要变更说明

## 任务 B：识别 ValueEdge 调用点
你是一个迁移审计员。
任务：扫描项目中使用 smartResolve 的位置。
输出：
1. 文件路径 + 用途
2. 是否需要替换为 ValueMappingService
3. 是否有逻辑差异风险

## 任务 C：行为一致性测试用例
你是测试架构师。
任务：列出 smartResolve 行为一致性测试用例。
要求覆盖：
- keyed 命中
- structural 命中
- required 字段缺失
- 类型不匹配
输出：测试场景列表
