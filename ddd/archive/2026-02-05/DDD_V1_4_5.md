# DDD 结晶记录 V1.4–V1.5

> 目标：基于 DDD 第一阶段产出通用语言、领域模型草图、关键不变量、实体字段表、以及 SurrealDB 用例级读写模型。

## 通用语言 V1.0
- Node（节点）：系统核心实体。承载结构化数据（JSON + Schema + Meta）与画布表现（Presentation）。
- Presentation（表现）：Node 的 UI 展示属性（位置、尺寸、样式、布局）。
- Form（表单）：结构化数据的输入/输出形态，是 Node 的 data 形式之一。
- Recipe（配方）：具备 ID 的 JSON→JSON 方法。
- RecipeNode：类型为 recipe 的 Node，必须包含 recipeId。
- Execution（执行）：Recipe 的运行实例；当前仅作为审计/日志。
- File（文件）：独立实体，描述媒体/文件及其预处理产物。
- Value Edge（值边）：以字段映射规则为语义的连接。默认 smartResolve，可显式映射。
- Product Edge（产物边）：表达派生/生成关系。

## 领域模型草图 V1.3
### Node Aggregate（核心）
- Node = 资产
- 包含 Presentation VO（位置/尺寸/样式/布局）
- 包含 Data（value/schema/meta）
- 可关联 FileId[]

### Edge Entity
- Edge 类型：value / product
- value edge 携带 MappingSpec（smart 或 explicit）

### Execution Aggregate（弱化为日志）
- ExecutionRun 记录 runId/recipeId/inputNodeId/outputNodeId/state/logs

### File Aggregate
- File 走独立 Ingestion Pipeline
- Node 只引用 FileId

## 关键不变量 V1.3
1. Node 是唯一核心实体。
2. RecipeNode 必须含 recipeId。
3. 执行必产生新 Node（不覆盖输入）。
4. File 独立存在，Node 仅引用 FileId。
5. Value Edge 是映射规则而非简单引用（默认 smartResolve，允许显式映射）。
6. Presentation 必须持久化（ReactFlow JSON 是投影，不是领域模型本体）。

## 领域事件 V1.3
- NodeCreated
- NodeUpdated
- NodeMoved / NodeResized / NodeStyled
- NodeExecutionStateChanged（含 stateUpdatedAt）
- ValueEdgeConnected
- ValueEdgeResolved
- ProductEdgeConnected
- RecipeExecuted
- ExecutionLogged
- FileImported
- FileLinkedToNode

## 应用服务（Use Case）V1.3
- CreateNodeUseCase
- UpdateNodeUseCase
- ConnectValueEdgeUseCase
- ResolveValueEdgeUseCase
- RunRecipeUseCase
- ImportFileUseCase

## Node 字段（V1.2 细化）
### Core Data
- id
- type
- data (JSON)
- schema
- meta
- recipeId?
- fileIds?

### Presentation VO（持久化）
- position
- size
- style
- collapsed
- layoutMode
- dockedTo
- expandedWidth
- expandedHeight
- originalPosition

### Execution State（持久化）
- executionState
- errorMessage?
- stateUpdatedAt

## MappingSpec（最终）
```ts
type MappingSpec = {
  mode: 'smart' | 'explicit',
  rules?: Array<{
    sourcePattern: string, // regex on field path
    targetKey: string,
    transform?: 'firstMatch'
  }>
}
```

## File 领域模型（V1.2）
- id
- mediaType (image/video)
- mimeType
- source (imported/generated/remote)
- storage.path
- variants.thumbnailPath (强制生成)
- metadata.width/height/duration

## 领域实体表格 V1.4
### Node
- id, type, data, schema, meta, recipeId?, fileIds?, presentation, executionState, errorMessage?, stateUpdatedAt

### Edge
- id, type, sourceNodeId, targetNodeId, mappingSpec?

### File
- id, mediaType, mimeType, source, storage.path, variants.thumbnailPath, metadata.width/height/duration

### ExecutionRun
- id, recipeId, inputNodeId, outputNodeId, state, logs

## SurrealDB 建模草图 V1.4
### Collections
- node
- edge
- file
- execution_run

### 关系
- Node -> File：fileIds
- Edge -> Node：sourceNodeId/targetNodeId

### 索引建议
- node: type, executionState
- edge: sourceNodeId, targetNodeId, type
- file: mediaType
- execution_run: inputNodeId, outputNodeId

## SurrealDB 用例级读写模型 V1.5
1. CreateNode
- 写入 node，初始化 executionState/stateUpdatedAt

2. UpdateNode
- 更新 data/schema/meta

3. UpdatePresentation
- 仅更新 presentation.*

4. ConnectValueEdge
- 写 edge(type=value)，默认 mappingSpec.mode=smart

5. ResolveValueEdge
- 读 edge + source/target node
- 执行 smart/explicit resolve
- 写 target node data

6. ConnectProductEdge
- 写 edge(type=product)

7. RunRecipe
- 更新输入 node executionState=running
- 执行 recipe -> output
- 创建 output node
- 创建 product edge
- 更新输入 node executionState=success/error
- 记录 execution_run

8. ImportFile
- FileIngestionService 生成 file（含 thumbnail/metadata）
- 创建 node（image/video）并绑定 fileIds
