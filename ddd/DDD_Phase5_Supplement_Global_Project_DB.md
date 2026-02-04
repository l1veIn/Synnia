# Phase 5 补充提示词：Global DB 与 Project DB 的 SurrealDB 方案

> 目的：补充 Phase5 提示词，明确 **全局数据库** 与 **项目数据库** 的拆分方案。
> 适用阶段：Phase 5（SurrealDB 持久化切换）

## 背景
当前存储结构分为两层：
- **Global DB**：全局索引、设置、项目注册表、配方索引
- **Project DB**：具体项目数据（nodes/edges/files/executions 等）

SurrealDB 切换时必须保留双层逻辑，而不是混成一个库。

---

## 目标设计（强制约束）
- **Global DB** 与 **Project DB** 必须隔离
- Global DB = 所有项目共享的数据
- Project DB = 单个项目的数据空间

---

## 推荐方案（SurrealDB 结构）

### 方案 A（推荐）：同一引擎、不同 database
- Namespace: `synnia`
- Global DB: `global`
- Project DB: `project_<projectId>`

优点：语义清晰；查询简单；隔离强。

### 方案 B：同一 DB 内按表隔离
- Namespace: `synnia`
- Database: `app`
- Table 以 `global_*` 与 `project_*` 区分

缺点：容易混淆，不推荐。

---

## 数据模型映射

### Global DB（推荐表）
- `projects`：项目注册表
- `app_settings`：应用全局设置
- `recipe_index`：配方索引
- `recipe_tags`：配方标签

### Project DB（推荐表）
- `node`
- `edge`
- `file`
- `execution_run`

---

## Repository 拆分建议

### Global Repos
- `ProjectRegistryRepository`
- `SettingsRepository`
- `RecipeIndexRepository`

### Project Repos
- `NodeRepository`
- `EdgeRepository`
- `FileRepository`
- `ExecutionRepository`

---

## 初始化策略（重要）
1. 应用启动时：初始化 Global DB
2. 打开项目时：切换到对应 Project DB
3. 关闭项目时：释放 Project DB 连接（或复用池）

---

## 实现建议（Tauri State 管理）

- `AppState.global_db` 持久存在
- `AppState.project_db` 在 openProject 时更新

伪结构：
```rust
struct AppState {
  global_db: Surreal<Db>,
  project_db: Mutex<Option<Surreal<Db>>>,
}
```

---

## 强制检查项（验收要求）
- 打开项目只写入 Project DB
- 关闭项目时 project_db 为空
- 所有 Global 功能仅访问 global_db

---

## 迁移注意
- 不需要旧数据迁移
- 但必须保证：新项目创建时自动注册到 Global DB

---

如果 agent 已在执行 Phase5，请立即将此补充方案同步给他们。
