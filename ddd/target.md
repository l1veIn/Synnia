# DDD 重构目标（冻结版）

> **目的**：定义重构终点，作为进度追踪的北极星。
> **冻结时间**：2026-02-05
> **重要**：本项目未发布，不需要向后兼容。

---

## 1. 核心约束（不可违反）

### 架构
- **四层 DDD**：`domain → application → infrastructure ← presentation`
- **前后端一致**：前端 TS 和后端 Rust 均采用相同四层划分

### 领域模型
- **Node=Asset 合一**：永久合并，无独立 Asset 概念
- **File 独立聚合**：Node 持有 `fileIds`，File 独立管理生命周期
- **Edge 单一类型**：靠 port 类型判断（Value/Product），无代码层分离

### 持久化
- **SQLite 为最终方案**
- **单通道 Graph Snapshot**：`nodes[] + edges[] + viewport + meta`
- **Schema 直接对应 Domain**：DB ↔ Domain 无投影层

---

## 2. 目录边界

### 必须存在
```
src/{domain, application, infrastructure, presentation}
src-tauri/src/{domain, application, infrastructure}
```

### 必须删除（已完成 ✅）
```
src/core/      ✅
src/features/  ✅
src/types/     ✅
```

### 必须删除（待完成）
```
src-tauri/src/features/   # 需拆分到 domain/application/infrastructure
```

---

## 3. Legacy 清理清单（验收必须完成）

### 前端
| 模块 | 范围 | 目标 |
|------|------|------|
| `domain/asset/types.ts` | 类型 | 移除，收敛到 `domain/node/` |
| `presentation/engine/AssetSystem.ts` | 兼容层 | 移除，直接使用 Node |
| `presentation/components/workflow/nodes/*` | 业务组件 | 更新为基于 Domain Node |
| Recipe 相关 | 业务类型 | 更新为基于 Domain Recipe |

### 后端
| 模块 | 范围 | 目标 |
|------|------|------|
| `src-tauri/src/features/*` | 目录 | 拆分到 domain/application/infrastructure |
| SQLite Schema | 数据库 | 直接对应 Domain（Node=Asset） |

---

## 4. 关键接口（稳定边界）

- `src/application/ports/*` — 业务层唯一依赖接口
- `src/presentation/engine/GraphEngine.ts` — UI 图写入入口
- `src/lib/apiClient.ts` — Tauri 调用唯一入口

---

## 5. 验收标准

1. **目录结构**：四层 DDD 完整，无 legacy 目录
2. **Legacy 清理**：上述清单全部完成
3. **类型一致**：所有业务 type 基于最新 Domain
4. **DB Schema**：直接映射 Domain，无投影
5. **测试通过**：现有测试全部通过

---

## 6. 详细参考

- 目录注释：[DDD_Target_Directory_Annotated.md](./DDD_Target_Directory_Annotated.md)
- 原始规格：[DDD_Target_Spec.md](./DDD_Target_Spec.md)
- 归档索引：[DDD_Archive_Index.md](./DDD_Archive_Index.md)
