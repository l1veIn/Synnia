# DDD 目标规格（终点定义）

> 目的：冻结 DDD 重构的“终点状态”，避免上下文漂移。
> 说明：本规格描述最终结构与责任边界，不要求一次性达到。

## 目录结构状态（模块划分与归属边界）

### 前端（React/TS）目标结构

```
src/                                    # 前端根目录
  application/                          # 用例层（唯一业务入口）
    use-cases/                          # 具体用例
    ports/                              # 依赖倒置接口
      repositories.ts
      services.ts

  domain/                               # 领域层（纯模型+规则）
    node/
    edge/
    recipe/
    file/
    shared/

  infrastructure/                       # 基础设施层（端口实现）
    tauri/
    database/                           # 目标为 SQLite（当前）
    file/

  presentation/                         # 展示层
    components/
    pages/
    hooks/
    state/
    adapters/
```

### 后端（Rust/Tauri）目标结构

```
src-tauri/src/
  domain/
    node/
    edge/
    recipe/
    execution/
    file/
  application/
    use_cases/
    ports/
  infrastructure/
    database/                           # SQLite 适配（当前）
    file/
    tauri/
```

### 必须存在的目录
- `src/application/`
- `src/domain/`
- `src/infrastructure/`
- `src/presentation/`
- `src-tauri/src/domain/`
- `src-tauri/src/application/`
- `src-tauri/src/infrastructure/`

### 已完成裁剪的目录（Stage 2-5 迁移，2026-02-05）
- ~~`src/core/`~~ ✅ 已拆分到 `domain/` + `presentation/`
- ~~`src/features/`~~ ✅ 已迁移到 `infrastructure/` + `application/`
- ~~`src/types/`~~ ✅ 已收敛到 `domain/` + `presentation/types/`
- `src/lib/`：部分函数仍保留，待未来逐步拆分

## 关键代码状态（入口、核心流程、关键接口）

### 前端入口与核心流程
- UI 入口：`presentation/pages/*` 触发用户行为
- 调用路径：`presentation` → `application/use-cases` → `domain` → `application/ports` → `infrastructure`
- 画布事件（连线、拖拽、执行）必须只通过用例层对领域进行修改

### 后端入口与核心流程
- 入口：Tauri commands（`infrastructure/tauri/*`）
- 调用路径：`infrastructure/tauri` → `application/use_cases` → `domain` → `application/ports` → `infrastructure/database`
- 数据持久化由 repository ports 统一抽象，不在 use_case 内直接访问 DB

### 关键接口（稳定边界）
- `src/application/ports/repositories.ts`
- `src/application/ports/services.ts`
- 领域聚合接口：`Node`, `Edge`, `Recipe`, `ExecutionRun`, `File`

## 重点领域模型状态（边界、职责、数据流）

### 领域边界与职责
- **Node**：与 Asset 合并后的核心实体，包含 schema/meta/presentation/data。
- **File**：独立聚合，负责重资产的入库与派生产物管理，Node 只保存 `fileIds`。
- **Edge**：值边（Value Edge）与产物边（Product Edge）分离，Value Edge 支持显式 MappingSpec。
- **Recipe**：JSON → JSON 的可执行定义；Recipe Node 是 Node 的一种类型。
- **ExecutionRun**：记录 Recipe 运行状态、错误与结果。

### 数据流（核心流程）
- 用户创建/修改节点 → 用例层更新 Node → repository 持久化
- 连接值边 → 用例层调用 ValueMappingService → 生成 MappingSpec → 持久化
- 运行配方 → ExecutionRun 生成 → 产出新 Node/Asset → 持久化
- 导入文件 → File 聚合入库 → Node 关联 `fileIds` → UI 展示

## 不变量（必须保持不变）

### 行为不变
- 画布创建、编辑、连线、执行等用户动作语义不改变
- 配方执行产出新资产的结果与现有流程一致

### API 不变
- 前端对外 API（hooks、调用路径、事件触发）不改变语义
- Tauri commands 对前端的契约保持不变

### 性能与安全约束
- 不引入显著启动耗时与运行时负担
- 不新增外部可攻击面或本地文件访问权限

## 验收标准（必须达成）

### 测试
- 现有测试命令全部通过（前端与后端）
- 若无自动化测试：提供手动验收清单并全部通过

### 手动验收清单
- 画布连线行为正确（值边/产物边）
- 配方执行可生成新资产
- 文件导入成功并可产生缩略图/元信息（如已有）
- 节点保存/加载行为一致

## 持久化层目标（当前阶段）
- **SQLite 为主**：现阶段目标以 SQLite 为主，稳定业务流程优先
- **SurrealDB 为未来可能**：仅作为未来阶段选项，不作为当前终点要求

## 前后端数据同步方案（必须写入规格）

### 同步对象（单通道）
- **唯一持久化对象**：Graph Snapshot（`nodes[] + edges[] + viewport + meta`）
- **Node=Asset 合一**：结构化数据、schema、meta 等统一存于 `node.data`
- **运行态数据**（聊天/执行日志）独立表，不参与 Graph Snapshot

### 同步策略（异步实时 + 关键点强制同步）
- **异步实时**：UI 操作更新 Store 后触发 Debounce 保存（建议 500–1500ms）
- **强制同步触发点**：
  - 手动保存（Ctrl+S / Save）
  - 项目切换或关闭
  - Recipe 执行完成（新 Node 产出）
  - 文件导入完成（新 Node 产出）

### 一致性与错误处理
- UI 以 Store 为准（乐观更新）
- DB 保存失败时 UI 显示未保存提示，下一次成功自动消除
- 不允许双通道（禁止独立资产表的“旁路同步”）

## 参考
- 结构蓝图已归档：`ddd/archive/2026-02-05/DDD_Target_Directory_Structure.md`
- 目标目录注释版：`ddd/DDD_Target_Directory_Annotated.md`
