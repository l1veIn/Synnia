# Phase 5 提示词（SurrealDB 持久化切换）

## 总体目标
- Node/Edge/File/Execution 持久化统一到 SurrealDB
- Zustand 成为 UI projection
- SQLite 逐步退役（保留只读或开发期调试）

## 重要约束
- 项目尚未发布，**不需要旧数据迁移**。

## 已完成内容（Phase 0-4.5）
- Domain 模型 + Use Cases 已建立
- File 聚合与 Recipe/Execution 迁移完成
- legacy 资产依赖已弱化（node.id 为默认资产锚）

## Phase 5 目标
- 建立 Repository 接口与 SurrealDB 实现
- 完成项目保存/加载链路切换

> 参考文档：
> - [DDD_V1_4_5.md](ddd/DDD_V1_4_5.md)
> - [DDD_Phase2_Model.md](ddd/DDD_Phase2_Model.md)
> - [DDD_Phase3_Implementation_Checklist.md](ddd/DDD_Phase3_Implementation_Checklist.md)
> - [DDD_Phase4_Implementation_Checklist.md](ddd/DDD_Phase4_Implementation_Checklist.md)
> - [DDD_Target_Directory_Structure.md](ddd/DDD_Target_Directory_Structure.md)

## 任务 A：Repository 接口定义（Application Ports）
你是领域架构师。
任务：在 `src/application/ports` 定义 Repository 接口。
要求：
- NodeRepository: create/update/get/listByProject/delete
- EdgeRepository: create/delete/listByProject
- FileRepository: create/get/listByProject/delete
- ExecutionRepository: create/update/listByNode
输出：接口定义 + 方法列表 + 说明

## 任务 B：SurrealDB 客户端与适配层
你是基础设施工程师。
任务：实现 SurrealDB 适配器。
要求：
- 新增 `src/infrastructure/surreal/SurrealClient.ts`
- 新增 Repository 实现（Node/Edge/File/Execution）
- 统一 projectId 维度隔离
输出：文件清单 + CRUD 查询示例

## 任务 C：Project Load/Save 链路切换
你是系统工程师。
任务：将项目保存/加载切换到 SurrealDB。
要求：
- `loadProject` 从 SurrealDB 取 Node/Edge/File
- `saveProject` 写入 SurrealDB（或增量更新）
- 保持 Zustand 为 UI projection
输出：改动文件清单 + 关键流程图

## 任务 D：一致性与性能验证
你是测试架构师。
任务：定义回归与性能场景。
要求：
- 项目加载/保存完整性
- 节点/边/文件一致性
- 大项目（>1000节点）加载性能
输出：验证清单
