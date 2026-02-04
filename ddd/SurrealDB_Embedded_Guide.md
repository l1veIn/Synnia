# SurrealDB Embedded 指南（Tauri 项目版）

> 目标：为当前 DDD 迁移提供**工程可用**的 SurrealDB 引入说明。
> 说明：本文是“可落地版本”，替换掉过度简化的宣传式描述。

---

## 1. 什么是 Embedded 模式（准确表述）
- **无需单独部署数据库服务**（不需要 Docker / 单独守护进程）。
- **但仍需要打包并分发 Tauri 应用本身**。
- 数据以本地文件形式存储（类似 SQLite），但引擎为 SurrealDB。

---

## 2. 你仍然需要做的事情（不能省略）
即使是 Embedded 模式，仍必须处理：
- **Schema/结构约束**（至少在 Domain 层）
- **关系一致性**（Node / Edge / File 的引用）
- **事务 / 批量写入策略**
- **projectId 维度隔离**（避免跨项目污染）

---

## 3. 依赖说明（后端）
### 3.1 Cargo.toml（示例）
**注意：SurrealDB features 可能随版本调整，务必以官方文档为准。**

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }

# SurrealDB (embedded)
# 示例 feature: kv-surrealkv 或 kv-rocksdb
surrealdb = { version = "2.0", features = ["kv-surrealkv"] }
```

> 如果 feature 不匹配，请根据官方文档调整。

---

## 4. 初始化模式（Tauri App State）
建议使用 Tauri State 管理 db 连接。

```rust
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use tauri::Manager;

struct AppState {
    db: Surreal<Db>,
}

async fn init_db(app_handle: &tauri::AppHandle) -> Surreal<Db> {
    let app_data_dir = app_handle.path().app_data_dir().expect("failed to get data dir");
    std::fs::create_dir_all(&app_data_dir).expect("failed to create data dir");

    let db_path = app_data_dir.join("synnia_db");
    let endpoint = format!("kv://{}", db_path.to_string_lossy());
    let db = Surreal::new::<SurrealKv>(&endpoint).await.unwrap();

    // 使用固定 namespace + 每个 projectId 对应一个 db
    db.use_ns("synnia").use_db("project_1").await.unwrap();

    db
}
```

---

## 5. Repository 设计建议
DDD 模型强调 Repository 层，而不是直接在 Command 中写 DB。

建议结构：
- NodeRepository
- EdgeRepository
- FileRepository
- ExecutionRepository

Repository 接口放在 `src/application/ports`，Surreal 实现在 `src/infrastructure/surreal`。

---

## 6. Query 风格（推荐原则）
- 写入：优先 `create / update`
- 读取：优先基于 projectId 的范围查询
- 批量保存：使用事务或多语句执行

**不要直接在 UI 层拼 SQL 字符串。**

---

## 7. 风险提醒
- **二进制体积增加**（10–20MB 量级）
- **大项目加载性能**需要评估
- **并发写入策略**要明确（避免冲突）

---

## 8. 结论
Embedded 模式可以显著简化部署，但 **不代表“无需设计”**。
建议以 DDD Repository 为核心组织结构，再将 SurrealDB 作为实现。
