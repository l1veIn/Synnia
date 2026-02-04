# Phase 4 实施清单（Execution / Recipe 迁移）

## 目标
- Recipe 与 ExecutionRun 领域模型落地
- RunRecipeUseCase 统一执行入口
- UseCase 负责执行状态更新

## 实施步骤
1. 领域模型
- 新增 `src/domain/recipe/Recipe.ts`
- 新增 `src/domain/recipe/ExecutionRun.ts`

2. 应用层用例
- 新增 `src/application/use-cases/run-recipe/`
- UseCase 负责：
  - 设置 executionState=running
  - 调用 executor
  - 生成 output Node
  - 设置 executionState=success/error
  - 写 ExecutionRun 日志

3. 适配现有执行器
- 通过 ports 接入 `ExecutorService`
- 保持 executor 行为不变

4. UI Hook 收敛
- `useRunRecipe` → 调用 RunRecipeUseCase
- UI 仅负责提示与 loading

5. 回归验证
- 运行配方（成功/失败）
- 生成输出节点
- 状态更新正确

## 风险控制点
- 执行状态双写（UI/UseCase）
- 旧 Execution 日志路径残留
- 输出节点命名与 schema 不一致
