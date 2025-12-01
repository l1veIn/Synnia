# Synnia - Product Requirement Document (PRD) & Core Philosophy

> **Slogan**: From Chaos to Canon. Locally.
> **Vision**: A digital asset consistency engine and semi-automated creative pipeline.

## 1. Core Philosophy (核心哲学)

### 1.1 Asset-as-Node (一切皆节点)
*   **Synnia**: 节点 = **资产实体** (Asset)。
    *   Examples: 图片, 文本, Prompt, 色板, 音频.
*   **Contrast**: 不同于 ComfyUI (功能即节点)，Synnia 的节点是产物本身。
*   **Goal**: 全局视野 (Global Vision) 和 资产的一致性 (Consistency)。

### 1.2 Consistency Engine (一致性引擎)
*   **Smart Links (智能连线)**: 所有的连线代表 **"依赖关系" (Dependency)**。
    *   **Computable (自动)**: 连线包含 "配方" (Recipe: Agent + Params)。上游变更 -> 下游自动重算。
    *   **Guidance (手动)**: 连线无配方 (Manual Link)。上游变更 -> 下游标记 "过期" (Stale) -> 仅提示红绿灯状态，需人工介入。
*   **Reactivity**: 系统的核心价值在于维护这张依赖网的状态，确保 IP 设定变更时，所有衍生品的状态是可知的。

### 1.3 Hybrid Interactions (双脑交互)
*   **Right Brain (创造)**:
    *   **Context**: 选中节点 -> **Chat with Agent**。
    *   **Flow**: 对话确认意图 -> Agent 生长出新节点。
*   **Left Brain (工具)**:
    *   **Context**: 选中节点 -> **Right-click / Toolbar**。
    *   **Flow**: 点击具体功能 (切图, 抠图, 格式转换) -> 立即生长出新节点。
*   **Manual (自由)**:
    *   拖拽上传文件，双击创建便利贴，手动连线建立逻辑依赖。

---

## 2. Architecture & Data Model (架构与数据)

### 2.1 Data Structure (SQLite)
*   **Project**: 对应一个文件系统的文件夹 (Bundle)。
*   **Asset**: 
    *   `id`, `type` (Image/Text/Link/Grid...), `current_version_id`.
*   **AssetVersion**: 
    *   `id`, `asset_id`, `payload` (FilePath or Content), `created_at`.
    *   **Immutable**: 历史版本只增不减，支持回溯。
*   **Edge**:
    *   `source_id`, `target_id`, `recipe` (JSON, Nullable).
    *   If `recipe` is present -> Auto-updatable.
    *   If `recipe` is null -> Manual dependency (Traffic Light only).

### 2.2 Agent System (Agent 策略)
*   **Definition**: Agent = Prompt Template + Model Config + Capabilities.
*   **Scope Separation**:
    *   **Global Scope**: API Keys, Base Endpoints (Secrets). 存放在用户应用数据目录，不随项目导出。
    *   **Project Scope**: Custom Agents (e.g., "My IP Writer"). 存放在项目数据库/文件夹中。导出项目时包含这些 Agent 定义（但不含 Key）。
*   **Management**: 
    *   UI 需要提供 Agent Manager 用于增删改查 Prompt 模板。
    *   导入他人项目时，若缺少 Key，提示用户在全局设置中填入 Key。

---

## 3. User Interface (UI)

*   **Canvas First**: 基于 React Flow 的无限画布。
*   **Chat Overlay**: 悬浮或侧边展开的对话框，用于驱动 Agent。
*   **Node Design**: 
    *   可折叠/展开 (e.g., 九宫格)。
    *   版本切换 (Left/Right Arrow)。
    *   状态指示器 (Green/Red/Processing).

---

## 4. Future Roadmap (Key Features)
*   **Export**: 导出整个项目为 Zip 包。
*   **Timeline**: (Maybe) 按照时间轴查看资产演变。
*   **Canon Generator**: 一键提取所有 "Final" 状态的资产，生成 Markdown 品牌手册。
