# DDD 重构目标（结晶版）

> **TEP Crystallization:** v1.0  
> **固化指数 (S):** 3  
> **语义漂移 (Δ):** 5%  
> **冻结时间:** 2026-02-05  
> **重要:** 本项目未发布，不需要向后兼容。

---

## 1. 核心约束（公理级）

### 1.1 架构依赖方向
```
presentation → application → domain ← infrastructure
```
- **presentation** 依赖 **application**（调用用例）
- **application** 依赖 **domain**（使用实体）
- **infrastructure** 实现 **application/ports/**（依赖倒置）
- **domain** 不依赖任何外层

### 1.2 领域模型
| 聚合 | 约束 | 说明 |
|------|------|------|
| **Node** | Node=Asset 永久合一 | 无独立 Asset 概念，schema/data/meta 统一存于 Node |
| **File** | 独立聚合，独立仓储 | Node 持有 `fileIds` 引用；删除 Node 不删除 File |
| **Edge** | 单一类型 | 通过 `FieldDefinition.connection` 判断 Value/Product，无代码层分离 |

### 1.3 持久化
| 约束 | 说明 |
|------|------|
| **SQLite 最终方案** | 不引入其他数据库 |
| **单通道 Graph Snapshot** | `nodes[] + edges[] + viewport + meta` 为唯一持久化通道 |
| **Schema 直接映射 Domain** | DB 字段与 Domain 实体一一对应，无运行时投影 |

---

## 2. 目录边界

### 前端（必须存在）
```
src/
├── domain/          # 实体、值对象、领域服务
├── application/     # Use Cases、Ports
├── infrastructure/  # Ports 实现、外部适配
└── presentation/    # UI 组件、ReactFlow、Hooks
```

### 后端（必须存在）
```
src-tauri/src/
├── domain/          # Node、Edge、File、Recipe 实体
├── application/     # use_cases、ports
└── infrastructure/  # SQLite、Tauri commands
```

### 必须删除
| 目录 | 状态 |
|------|------|
| `src/core/` | ✅ 已删除 |
| `src/features/` | ✅ 已删除 |
| `src/types/` | ✅ 已删除 |
| `src-tauri/src/features/` | ⏳ 待拆分 |

---

## 3. Legacy 清理清单

### 前端
| 模块 | 类型 | 目标 |
|------|------|------|
| `domain/asset/types.ts` | Legacy 类型 | 收敛到 `domain/node/`，然后删除 |
| `presentation/engine/AssetSystem.ts` | 兼容层 | 移除，Node CRUD 直接走 Use Cases |
| `application/adapters/nodeProjection.ts` | 兼容适配 | 移除，UI 直接使用 Domain Node |
| Recipe 相关业务类型 | 类型定义 | 更新为基于 `domain/recipe/` |

### 节点组件迁移（`presentation/components/workflow/nodes/*`）

**通用改动：**
| 文件 | 当前实现 | 目标实现 |
|------|----------|----------|
| `*/behavior.ts` | 直接操作 Store/AssetSystem | 调用 Use Cases |
| `*/Inspector.tsx` | 使用 `useAsset` + legacy 类型 | 使用 Domain Node + Use Cases |
| `*/definition.ts` | `create()` 返回 `asset` 对象 | 返回 Domain Node 格式 |

**具体节点：**
| 节点 | 关键改动 |
|------|----------|
| `TextNode` | behavior 调用 `updateNodeUseCase` |
| `ImageNode` | behavior 调用 `updateNodeUseCase` + `importFileUseCase` |
| `FormNode` | behavior 调用 `updateNodeUseCase` |
| `TableNode` | behavior 调用 `updateNodeUseCase` |
| `SelectorNode` | behavior 调用 `updateNodeUseCase` |
| `GalleryNode` | behavior 调用 `updateNodeUseCase` |
| `RecipeNode` | behavior 调用 `runRecipeUseCase` + `updateNodeExecutionUseCase` |

**portRegistry 改动：**
- `dynamic()` 函数：访问 `node.data` 而非 `asset.value`


### 后端
| 模块 | 类型 | 目标 |
|------|------|------|
| `src-tauri/src/features/*` | 目录 | 拆分到 domain/application/infrastructure |
| SQLite Schema | 数据库 | 重构为直接映射 Domain（Node=Asset） |

---

## 4. 关键接口（稳定边界）

| 接口 | 职责 |
|------|------|
| `application/ports/*` | 业务层唯一依赖接口（仓储、外部服务） |
| `presentation/engine/GraphEngine.ts` | UI 图协调入口（调用 Use Cases，不直接写 Store） |
| `lib/apiClient.ts` | Tauri invoke 唯一入口 |

---

## 5. Use Cases 清单

### 前端
- `create-node` — 创建节点
- `update-node` — 更新节点数据
- `update-node-presentation` — 更新节点展示态（位置、样式）
- `update-node-execution` — 更新执行状态
- `run-recipe` — 运行配方
- `import-file` — 导入文件

### 后端（期望对称）
- `load_project` / `save_project`
- `create_node` / `update_node`
- `import_file`
- `execute_recipe`

---

## 6. 验收标准

| 标准 | 可量化指标 |
|------|-----------|
| **目录结构** | 四层 DDD 完整，无 legacy 目录 |
| **Legacy 清理** | §3 清单全部完成 |
| **类型一致** | 所有业务 type 基于 `domain/*` |
| **DB Schema** | 直接映射 Domain，无 `nodeProjection` |
| **CI 通过** | `pnpm lint` 0 errors + `pnpm tsc --noEmit` + `cargo check` |

---

## 8. 详细参考

- [reference.md](./reference.md) — **Agent 快速入门**（Domain 模型、Use Case 接口、迁移示例）
- [DDD_Target_Directory_Annotated.md](./DDD_Target_Directory_Annotated.md) — 目录注释
- [DDD_Target_Spec.md](./DDD_Target_Spec.md) — 原始规格
- [DDD_Archive_Index.md](./DDD_Archive_Index.md) — 归档索引

