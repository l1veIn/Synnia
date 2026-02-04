# DDD V1.7 分支迁移路线图

## 阶段 0：建立迁移分支与边界
- 新建分支 codex/ddd-migration
- 建立目录骨架：
  - src/domain/
  - src/application/
  - src/infrastructure/
  - src/presentation/（可选）
- 约束规则：
  - Domain 不依赖 UI/Store/Tauri
  - Application 依赖 Domain + Repository
  - Infrastructure 适配外部系统

## 阶段 1：Value Mapping 迁移
- 抽 ValueMappingService 到 Domain
- smartResolve 迁移为 domain 服务
- Connect/Resolve ValueEdge 使用新服务
- 行为一致性验证

## 阶段 2：Node 模型迁移
- Node=Asset 合并模型
- 引入 Presentation VO
- Node 创建/更新统一走 Use Case

## 阶段 3：File 模型迁移
- 引入 File Aggregate
- importHeavyNode 拆分：
  - FileIngestionService（Domain）
  - TauriFileAdapter（Infra）
- Node 绑定 fileIds

## 阶段 4：Execution / Recipe 迁移
- Recipe 定义迁移至 Domain
- ExecutionRun 作为日志实体
- RunRecipeUseCase 统一入口

## 阶段 5：SurrealDB 持久化切换
- Node/Edge/File/Execution Repository 统一
- Zustand 仅作为 UI projection
- 后端仅负责 Repository + Ingestion + Execution

## 风险控制点
- 每阶段保证行为一致
- 回归场景：
  - Node 创建
  - 连接
  - 运行 Recipe
  - 导入文件
