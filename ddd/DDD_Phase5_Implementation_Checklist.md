# Phase 5 实施清单（SurrealDB 持久化切换）

## 目标
- SurrealDB 统一存储 Node/Edge/File/Execution
- Zustand 仅作为 UI projection
- SQLite 退役或仅保留开发调试用途

## 约束
- 项目尚未发布，不需要旧数据迁移
- SQLite 初始化仅保留在 debug 模式（生产默认禁用）

## 实施步骤（详细）

### 1) Repository 接口
- 新增 `NodeRepository`
  - create/update/get/listByProject/delete
- 新增 `EdgeRepository`
  - create/delete/listByProject
- 新增 `FileRepository`
  - create/get/listByProject/delete
- 新增 `ExecutionRepository`
  - create/update/listByNode

### 2) SurrealClient 初始化
- 新增 `src/infrastructure/surreal/SurrealClient.ts`
- 负责连接、鉴权、命名空间/数据库
- 统一 projectId scope

### 3) Repository 实现
- NodeRepository → SurrealDB
- EdgeRepository → SurrealDB
- FileRepository → SurrealDB
- ExecutionRepository → SurrealDB

### 4) Project Load
- `loadProject` 读取 node/edge/file
- 组装到 `SynniaProject`
- Zustand 更新 nodes/edges/files

### 5) Project Save
- `saveProject` 将 nodes/edges/files 写入 SurrealDB
- 先清理旧记录（project scope）或做增量写入

### 6) UI 投影策略
- Zustand 只保存 UI 展示所需字段
- 保持 Node/Edge/File 为单一真实来源

### 7) 验证
- 保存/加载后节点与文件一致
- 执行状态保留
- 配方执行产生的新节点持久化

## 风险控制点
- projectId 边界隔离错误导致数据串线
- 并发保存可能导致冲突
- 大项目加载性能

## 验证清单（回归 + 性能）
- 项目加载后 nodes/edges/files 数量一致（Surreal vs UI）
- 画布位置/缩放（viewport）保持不变
- 节点执行状态与错误信息保留（executionState/errorMessage）
- 删除节点/边/文件后，Surreal 数据同步删除
- 配方执行产生的新节点与产物边可持久化
- 大项目（>1000 节点）加载时间记录（目标 < 2s，记录基线）
- 大项目保存时间记录（增量/全量）
