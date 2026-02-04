# Phase 5 实施清单（SurrealDB 持久化切换）

## 目标
- SurrealDB 统一存储 Node/Edge/File/Execution
- Zustand 仅作为 UI 投影

## 实施步骤
1. Repository 接口
- NodeRepository
- EdgeRepository
- FileRepository
- ExecutionRepository

2. SurrealDB Adapter
- SurrealClient
- CRUD 查询

3. 替换持久化
- Project load/save 改为 SurrealDB
- SQLite 逐步退役

4. 回归验证
- 保存/加载项目
- 节点/边/文件一致性

## 风险控制点
- 数据迁移脚本
- 离线模式
