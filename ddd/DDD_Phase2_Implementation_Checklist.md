# Phase 2 实施清单（Node 模型迁移）

## 目标
- Node=Asset 领域模型落地
- 引入 Presentation VO
- 执行状态字段持久化
- 统一 Node 创建/更新入口（应用层）

## 实施步骤
1. 建立领域模型文件
- 新增 `src/domain/node/Node.ts`
- 新增 `src/domain/node/NodePresentation.ts`
- 新增 `src/domain/node/NodeMeta.ts`
- 新增 `src/domain/node/NodeSchema.ts`

2. 设计兼容投影层
- 新增 `src/application/adapters/nodeProjection.ts`
- 产出 `toLegacySynniaNode` / `fromLegacy` 函数

3. 引入 Application Use Case
- 新增 `src/application/use-cases/create-node/`
- 新增 `src/application/use-cases/update-node/`
- 新增 `src/application/use-cases/update-node-presentation/`
- 新增 `src/application/use-cases/update-node-execution/`

4. 替换调用入口
- `GraphMutator.createSmart` → 调用 `CreateNodeUseCase`
- `GraphEngine.updateNode/updateNodes` → 调用 `UpdateNodeUseCase`
- `useRunRecipe` → `UpdateNodeExecutionUseCase`

5. 兼容 AssetSystem
- 保留 `AssetSystem` 作为 Node 仓储薄包装
- `AssetSystem.update/updateConfig/updateSys` 内部改为 Node update

6. 测试与验证
- 回归：创建节点、连线、执行配方、导入文件
- UI 状态：执行状态加载正确

## 风险控制点
- Node.id 与 assetId 合并导致路径断裂
- title 与 sys.name 双写冲突
- schema 来源不一致
- Presentation 字段遗漏
