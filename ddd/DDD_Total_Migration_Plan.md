# 总迁移计划（直达目标结构）

> 目标：完成 `DDD_Target_Directory_Structure.md` 中的最终目录结构。

## 总目标结构（简写）
```
src/
  domain/
  application/
  infrastructure/
  presentation/
  core/engine/      # 仅 UI 交互残留
  features/         # 仅 UI
  types/            # 迁移完后删除
```

---

## 总体迁移分解

### 阶段 1：UI 路径归位
- 迁移 `components/` → `presentation/components/`
- 迁移 `pages/` → `presentation/pages/`
- 迁移 `hooks/` → `presentation/hooks/`
- 修复引用与路径

### 阶段 2：features 结构清理
- `features/recipes` → domain/application
- `features/executors` → infrastructure
- `features/models` → infrastructure
- features 仅保留 UI

### 阶段 3：core/engine 退役
- GraphMutator 仅保留 UI 操作
- 业务逻辑全部收敛到 UseCase
- 删除旧业务方法

### 阶段 4：types 清理
- legacy `src/types/*` 迁入 `domain/`
- 删除旧 types

### 阶段 5：最终一致性校验
- 清理空目录
- 修复路径
- 文档同步

---

## 风险控制点
- 每阶段必须保持编译通过
- 每阶段跑基础回归（打开项目/运行配方/导入文件）
- 每阶段合并前做路径清单核对
