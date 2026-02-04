# 最终目录结构参考（目标态）

> 目标：提供 DDD 重构后的目录结构“参考蓝图”。
> 说明：这是目标态，不要求一次性达成。

## 前端（React/TS）

```
src/                                    # 前端根目录
  application/                          # 用例层
    use-cases/                          # 具体用例
      create-node/                      # 创建节点
      update-node/                      # 更新节点
      connect-value-edge/               # 建立值边
      resolve-value-edge/               # 执行值映射
      connect-product-edge/             # 建立产物边
      run-recipe/                       # 运行配方
      import-file/                      # 导入文件
    ports/                              # 端口（依赖倒置接口）
      repositories.ts                   # 仓储接口
      services.ts                       # 外部服务接口

  domain/                               # 领域层
    node/                               # Node 聚合
      Node.ts                           # Node 实体
      NodePresentation.ts               # Presentation VO
      NodeMeta.ts                       # Meta VO
      NodeSchema.ts                     # Schema VO
    edge/                               # Edge 与映射
      Edge.ts                           # Edge 实体
      MappingSpec.ts                    # 显式映射规则
      ValueMappingService.ts            # 映射领域服务
    recipe/                             # Recipe / Execution
      Recipe.ts                         # Recipe 定义
      ExecutionRun.ts                   # 执行日志实体
    file/                               # File 聚合
      File.ts                           # File 实体
      FileMetadata.ts                   # 文件元信息
      FileVariants.ts                   # 文件派生产物
      FileIngestionPolicy.ts            # 预处理策略
    shared/                             # 共享类型/错误
      types.ts                          # 共享类型
      errors.ts                         # 领域错误

  infrastructure/                       # 基础设施层
    tauri/                              # Tauri 适配
      TauriCommandClient.ts             # Tauri 命令适配器
    surreal/                            # SurrealDB 适配
      SurrealClient.ts                  # DB 客户端
      NodeRepository.ts                 # Node 仓储实现
      EdgeRepository.ts                 # Edge 仓储实现
      FileRepository.ts                 # File 仓储实现
      ExecutionRepository.ts            # Execution 仓储实现
    file/                               # 文件系统适配
      FileStorageAdapter.ts             # 本地/云存储

  presentation/                         # 展示层
    components/                         # 组件
    pages/                              # 页面
    hooks/                              # 视图层 hooks
    state/                              # UI 状态（非领域）
    adapters/                           # UI ↔ 用例适配

  core/                                 # 现有核心模块（迁移中）
    engine/                             # 引擎（逐步抽到 domain/application）
    registry/                           # 注册表（逐步抽到 domain）

  features/                             # 现有功能模块（迁移中）
    recipes/                            # 配方（逐步抽到 domain/application）
    executors/                          # 执行器（逐步抽到 infrastructure）
    models/                             # 模型/Provider（逐步抽到 infrastructure）

  types/                                # 现有类型定义（逐步收敛到 domain）
  lib/                                  # 现有工具库（逐步拆分）
```

## 后端（Rust/Tauri）

```
src-tauri/src/                         # Tauri 后端根目录
  domain/                               # 领域层
    node/                               # Node 聚合
    edge/                               # Edge 与映射
    recipe/                             # Recipe 定义
    execution/                          # ExecutionRun
    file/                               # File 聚合
  application/                          # 用例层
    use_cases/                          # 具体用例
      create_node.rs                    # 创建节点
      connect_value_edge.rs             # 建立值边
      run_recipe.rs                     # 运行配方
      import_file.rs                    # 导入文件
    ports/                              # 端口接口
      repositories.rs                   # 仓储接口
      services.rs                       # 外部服务接口
  infrastructure/                       # 基础设施层
    database/                           # 数据库适配
    surreal/                            # SurrealDB 适配
    file/                               # 文件系统适配
    tauri/                              # Tauri 命令适配
  features/                             # 现有功能模块（逐步迁移）
```

## 说明与约束
- Domain 不依赖 UI/Store/Tauri/DB
- Application 依赖 Domain + Ports
- Infrastructure 实现 Ports
- Presentation 只调用 Application

## 当前目录结构中“过时/待迁移”的部分（列表）
- `src/core/engine/*`：领域规则与状态管理混合，需拆分到 Domain/Application。
- `src/features/recipes/*`：UI 与领域逻辑混合，需迁移 Recipe/Execution 相关部分。
- `src/features/executors/*`：执行器应成为 Infrastructure 适配。
- `src/features/models/*`：模型 Provider 应迁移到 Infrastructure。
- `src/lib/importHeavyNode.ts`：文件导入逻辑混合 UI+领域+基础设施，应拆成 FileIngestionService + Adapter。
- `src/types/assets.ts`：资产模型需与 Node=Asset 合并并迁移到 Domain。
- `src/types/project.ts`：节点/画布类型应收敛到 Domain + Presentation VO。
- `src-tauri/src/features/*/commands.rs`：用例逻辑混杂，需迁移到 application/use_cases。
- `src-tauri/src/infrastructure/database.rs`：SQLite 逻辑后续将被 SurrealDB 适配替换。

## 迁移节奏建议
- 先抽 Domain/ValueMappingService
- 再抽 Node 模型
- 再引入 File
- 最后替换持久化
