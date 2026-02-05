# 目标目录结构（带关键文件注释）

> 目的：在“目标结构”基础上标注关键文件与职责边界。
> 说明：仅列出关键路径与核心接口/函数，非完整文件列表。

## 前端（React/TS）

```
src/
  main.tsx                        # 应用入口，挂载 React
  App.tsx                         # 顶层路由/布局入口

  application/                    # 用例层：业务编排，唯一写入口
    use-cases/
      create-node/                # createNodeUseCase
      update-node/                # updateNodeUseCase
      update-node-execution/      # 更新执行状态与错误信息
      update-node-presentation/   # 更新展示态
      run-recipe/                 # runRecipeUseCase
      import-file/                # importFileUseCase
    ports/
      GraphMutatorPort.ts         # 图写入端口
      ExecutorService.ts          # 执行器端口
      ExecutionLoggerPort.ts      # 执行日志端口
      index.ts                    # ports 统一出口

  domain/                         # 领域层：实体、值对象、领域服务
    node/                         # Node=Asset 合一聚合（核心设计）
      Node.ts                     # Node 实体（包含原 Asset 的 schema/data/meta）
      NodePresentation.ts         # Presentation VO（样式/位置/折叠）
      NodeMeta.ts                 # Meta VO（名称/时间戳）
      NodeSchema.ts               # Schema VO
      utils/nodeAsset.ts          # 统一节点资产解析
    edge/
      ValueMappingService.ts      # 值映射领域服务
    recipe/
      Recipe.ts                   # Recipe 实体
      ExecutionRun.ts             # ExecutionRun 实体
      manifest.ts                 # Recipe 清单类型
      types.ts                    # Recipe 运行时类型
    file/
      File.ts                     # File 聚合根
      FileMetadata.ts             # 元信息 VO
      FileVariants.ts             # 变体 VO
      FileIngestionService.ts     # 入库策略接口
    registry/
      NodeRegistry.ts             # 节点注册
      StandardBehavior.ts         # 标准行为
    asset/                        # ⚠️ Legacy 兼容层（待移除）
      types.ts                    # @deprecated - 类型已收敛到 Node
    shared-types/
      widgets.ts                  # WidgetType 共享类型

  infrastructure/                 # 适配层：实现 ports
    tauri/
      TauriFileAdapter.ts         # fileIngestionService 适配
    chat/                          # LLM/线程存储适配
    models/                        # LLM Provider/模型适配
    executors/                     # 执行器适配

  presentation/                   # 展示层：ReactFlow + UI
    pages/
      Canvas.tsx                  # 画布入口，加载/保存/水合
    engine/
      GraphEngine.ts              # UI 图协调器（只读写 Store）
      GraphMutator.ts             # 图写入封装
      AssetSystem.ts              # 旧资产兼容层（待移除）
    hooks/
      useAutoSave.ts              # autosave 入口（Graph Snapshot）
      useRunRecipe.ts             # 执行入口
      useChatContext.ts           # 操作层日志
    components/workflow/
      nodes/                      # 节点 UI
      edges/                      # 边 UI

  store/                          # Zustand Store
    workflowStore.ts              # nodes/edges/assets/files/viewport
    recipeStore.ts                # recipe 相关状态
    uiPreferencesStore.ts         # UI 偏好

  lib/
    apiClient.ts                  # Tauri invoke 统一入口
    importHeavyNode.ts            # 文件导入门面
```

## 后端（Rust/Tauri）

```
src-tauri/src/
  main.rs                          # Tauri 主入口
  lib.rs                           # Tauri commands 注册

  features/project/
    commands.rs                    # project lifecycle commands
    persistence.rs                 # SQLite 项目读写

  infrastructure/
    database.rs                    # SQLite schema + migrations

  domain/
    project.rs                     # SynniaProject 结构
    graph.rs                       # Graph / Node / Edge
    asset.rs                       # Asset 结构（兼容）

  global/                          # 全局数据库（项目列表等）
```

## 关键接口清单（目标稳定边界）

- `src/application/ports/*`：业务层唯一依赖接口
- `src/lib/apiClient.ts`：前端调用 Tauri 的唯一入口
- `src/presentation/engine/GraphEngine.ts`：UI 对图的唯一写入口
- `src-tauri/src/features/project/persistence.rs`：项目持久化边界
- `src-tauri/src/infrastructure/database.rs`：SQLite schema/migrations

## 关键函数清单（最小认知路径）

- `load_project` / `save_project`：项目加载/保存
- `load_project_sqlite` / `save_project_sqlite`：SQLite 读写
- `useAutoSave`：Graph Snapshot 自动保存
- `updateNodeUseCase` / `createNodeUseCase`：节点写入
- `importFileUseCase`：文件入库与节点创建
- `ValueMappingService.resolve()`：值映射逻辑入口

## 依赖与引用关系（必须清晰）

### 依赖方向规则（强约束）
- `presentation` → `application` → `domain`
- `application` → `domain` + `application/ports/*`
- `infrastructure` 实现 `application/ports/*`（反向依赖禁止）
- `domain` 不依赖 UI/DB/Tauri

### 前端关键依赖链（按调用路径）
- `presentation/pages/Canvas.tsx`  
  → `store/workflowStore.ts`（状态）  
  → `lib/apiClient.ts`（Tauri 命令）  
  → `application/use-cases/*`（用例入口）  
  → `presentation/engine/GraphEngine.ts`（画布交互写入）

- `presentation/engine/GraphEngine.ts`  
  → `store/workflowStore.ts`（唯一写入口）  
  → `application/use-cases/update-node`（业务更新）  
  → `domain/node/utils/nodeAsset`（节点资产解析）

- `presentation/hooks/useAutoSave.ts`  
  → `store/workflowStore.ts`（nodes/edges/viewport）  
  → `lib/apiClient.ts` → `save_project_autosave`

- `lib/importHeavyNode.ts`  
  → `application/use-cases/import-file`  
  → `infrastructure/tauri/TauriFileAdapter.ts`（文件入库）  
  → `presentation/engine/GraphEngine.ts`（创建节点）

### Application 层依赖链（端口驱动）
- `application/use-cases/*`  
  → `domain/*`（实体/规则）  
  → `application/ports/*`（仓储/外部服务）

### Infrastructure 层实现链
- `infrastructure/tauri/TauriFileAdapter.ts`  
  → `lib/apiClient.ts` → Tauri `import_resource`

- `infrastructure/models/*`  
  → `application/ports/ExecutorService`（执行器端口）

### 后端依赖链（Rust/Tauri）
- `src-tauri/src/main.rs` / `lib.rs`  
  → `features/*/commands.rs`（Tauri commands）  
  → `features/project/persistence.rs`（SQLite 读写）  
  → `infrastructure/database.rs`（schema + migrations）

### 当前兼容层（待移除路径）
- `presentation/engine/AssetSystem.ts`  
  → `lib/apiClient.ts` → `save_asset`  
  - 说明：这是旧资产通道，终点结构应移除该旁路
