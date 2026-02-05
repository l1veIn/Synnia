# 当前状态（Current State）

> 最后更新：2026-02-05
> 当前 Commit：`bf07587`
> 分支：`codex/ddd-migration`

---

## 1. 已完成的变更

### ✅ 目录结构（Stage 2-5 完成）
| 原目录 | 状态 | 目标 |
|--------|------|------|
| `src/core/` | ✅ 已删除 | 拆分到 domain/presentation |
| `src/features/` | ✅ 已删除 | 迁移到 infrastructure/application |
| `src/types/` | ✅ 已删除 | 分层到 domain/presentation |

### ✅ 领域模型（Phase 1-4 完成）
- `domain/node/` — Node=Asset 合一聚合
- `domain/edge/ValueMappingService.ts` — 值映射领域服务
- `domain/file/` — File 独立聚合
- `domain/recipe/` — Recipe 实体与执行类型
- `domain/registry/` — 节点注册

### ✅ 应用层（Phase 2-4 完成）
- `application/use-cases/create-node/`
- `application/use-cases/update-node/`
- `application/use-cases/update-node-execution/`
- `application/use-cases/update-node-presentation/`
- `application/use-cases/run-recipe/`
- `application/use-cases/import-file/`

---

## 2. 当前代码状态快照

### 前端目录结构
```
src/
├── application/     ✅ 用例层
├── domain/          ✅ 领域层
├── infrastructure/  ✅ 基础设施层
├── presentation/    ✅ 展示层
├── store/           Zustand 状态
└── lib/             工具库
```

### 后端目录结构
```
src-tauri/src/
├── features/        ⚠️ 待拆分
├── infrastructure/  ✅ 基础设施
├── domain/          ✅ 领域（部分）
└── global/          全局数据库
```

---

## 3. 待处理事项

### 高优先级（Legacy 清理）
| 模块 | 状态 | 说明 |
|------|------|------|
| `domain/asset/types.ts` | ⏳ | 迁移到 domain/node，然后删除 |
| `presentation/engine/AssetSystem.ts` | ⏳ | 移除，直接使用 Node |
| `presentation/components/workflow/nodes/*` | ⏳ | 更新为基于 Domain Node |
| Recipe 相关业务类型 | ⏳ | 更新为基于 Domain Recipe |

### 中优先级（后端重构）
| 模块 | 状态 | 说明 |
|------|------|------|
| `src-tauri/src/features/` | ⏳ | 拆分到 domain/application/infrastructure |
| SQLite Schema | ⏳ | 适应 Node=Asset，直接映射 Domain |

### 低优先级（优化）
| 模块 | 状态 | 说明 |
|------|------|------|
| `lib/importHeavyNode.ts` | ⏳ | 可拆分为 FileIngestionService |

---

## 4. 参考链接

- 目标锚点：[target.md](./target.md)
- 历史锚点：[checkpoint/](./checkpoint/)
