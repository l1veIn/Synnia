# DDD V1.7 任务提示词（分发给其他 Agent）

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

## 任务 D：阶段 2 预研（Node 模型迁移）
你是领域建模工程师。
任务：根据现有 types（project.ts / assets.ts）梳理 Node=Asset 的字段映射。
输出：
1. 字段对齐表
2. 需要新增/废弃字段
3. 风险点

## 任务 E：File 预处理抽取
你是基础设施架构师。
任务：阅读 importHeavyNode 与后端 import_resource，梳理 File Ingestion Pipeline。
输出：
1. 必须产出的字段
2. 缩略图/元信息流程
3. 建议的 File 模型字段
