# Synnia Architectural Audit & Technical Roadmap

> **Auditor Role**: Chief System Architect
> **Date**: 2025-12-01
> **Objective**: Transition Synnia from a successful MVP/POC to an industrial-grade, scalable system.

---

## 1. The State Synchronization Problem (Critical)

### Current Status
*   **Polling/Request-Response Pattern**: Frontend triggers Rust command -> Waits for completion -> Fetches entire graph again.
*   **Risks**: 
    *   Long-running tasks (e.g., ComfyUI generation) will block or timeout frontend requests.
    *   UI state becomes stale if multiple components modify data (e.g., Inspector vs Canvas).
    *   "Callback Hell" in React components.

### 🌟 Master Recommendation: Event-Driven Architecture
*   **Rust as Source of Truth**: Only Rust modifies the state.
*   **Event Bus**: Use Tauri's `emit` to push updates to frontend proactively.
    *   Frontend: `listen('graph:updated', (event) => updateNodes(event.payload))`
    *   Backend: `emit_all('graph:updated', ...)` after any DB write.
*   **Optimistic UI (Optional)**: Frontend updates UI immediately for perceived speed, rolls back if backend event returns error.

## 2. Backend Modularity ("The God Object")

### Current Status
*   **Bloated `commands.rs`**: Contains DB logic, File IO, LLM calls, and API handling mixed together.
*   **Risks**: untestable logic, spaghetti code, difficult to add new integrations (ComfyUI, OpenAI).

### 🌟 Master Recommendation: Service Layer
*   **Controller Layer**: `commands.rs` (Only handles Tauri input/output).
*   **Service Layer**: 
    *   `services/agent_service.rs`: LLM logic, prompt templating.
    *   `services/file_service.rs`: Path resolution, file copy/delete.
    *   `services/comfy_service.rs`: WebSocket handling, workflow construction.
*   **Data Layer**: `db.rs` (Pure CRUD, no business logic).

## 3. Type Safety & Automation

### Current Status
*   **Manual Sync**: `struct` in Rust and `interface` in TypeScript are manually maintained.
*   **Risks**: Runtime errors due to field mismatches (e.g., `label` field missing).

### 🌟 Master Recommendation: Automated Type Generation
*   **Leverage `ts-rs`**: We added the dependency; now we must use it.
*   **CI Pipeline**: Configure `cargo test` or a build script to automatically export TS definitions to `src/types/generated/` on every build.
*   **Rule**: Never manually write a TypeScript interface that mirrors a Rust struct.

## 4. Agent Execution Pipeline

### Current Status
*   **Hardcoded Logic**: `chat_with_agent` assumes a simple LLM call.
*   **Risks**: Cannot support complex agents (e.g., RAG, Image Gen loops, Tool Chains).

### 🌟 Master Recommendation: Pipeline Engine
*   **Agent = Workflow**: An Agent's action should be defined as a pipeline of steps, not a single function call.
*   **Extensibility**: Future "Agent Definitions" in DB should support defining these steps (declaratively or via script).

## 5. Hygiene & Best Practices

*   **Structured Errors**: Replace `Result<T, String>` with `Result<T, AppError>`. Allow frontend to react to specific error codes (Auth, Network, IO).
*   **Logging**: Replace `println!` with `log` / `tracing` crates for file-based logging and log levels (Info, Debug, Error).
*   **Path Handling**: Eliminate all hardcoded paths (e.g., `C:\Users\...`). Use Tauri's `path_resolver` to dynamically find AppData/Documents folders.

---

## 🚀 Immediate Action Items (The Refactor Sprint)

1.  **Event Bus Implementation**: Stop returning data from `create_node`. Return `Ok()` and emit `node_created` event instead.
2.  **Setup `ts-rs` Export**: Create a `bindings` test/script to auto-generate `src/types/synnia.ts`.
3.  **Refactor `commands.rs`**: Extract `call_gemini_agent` into a proper `AgentService` struct/module.
