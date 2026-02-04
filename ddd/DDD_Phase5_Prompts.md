# Phase 5 提示词（SurrealDB 持久化切换）

## 总体目标
- Node/Edge/File/Execution 持久化统一到 SurrealDB
- Zustand 成为 UI projection

## 已完成内容（Phase 0-4）
- Domain 模型与 Use Cases 已建立
- File 聚合与 Recipe/Execution 迁移完成

## Phase 5 目标
- 引入 SurrealDB Repository
- 建立 Node/Edge/File/Execution 的持久化接口
- 替换 SQLite 依赖

> 参考文档：
> - [DDD_V1_4_5.md](ddd/DDD_V1_4_5.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 A：Repository 接口定义
你是领域架构师。
任务：在 application/ports 定义 Node/Edge/File/Execution Repository 接口。
输出：接口定义 + 方法列表

## 任务 B：SurrealDB Adapter
你是基础设施工程师。
任务：实现 SurrealDB 适配器。
要求：
- 建立 SurrealClient
- 实现 repository
输出：文件清单 + 查询示例

## 任务 C：持久化切换
你是迁移工程师。
任务：替换现有 SQLite 读写路径。
输出：替换清单 + 风险
