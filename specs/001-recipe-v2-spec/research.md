# Research & Decisions: Recipe V2 Architecture

**Feature**: Recipe V2 Architecture Upgrade
**Date**: 2025-12-30

## Decisions

### 1. Chat Context Storage
- **Decision**: Store `chatContext` directly inside `RecipeAsset.config` alongside `schema` and `modelConfig`.
- **Rationale**: Keeps the asset self-contained. `RecordAsset` is designed to hold structured data.
- **Alternatives Considered**:
    - *Separate `ChatAsset`*: Rejected to avoid asset proliferation for every recipe instance.
    - *Node Data*: Rejected because data should outlive the graph node (Asset-centric philosophy).

### 2. Inspector Architecture
- **Decision**: Refactor `RecipeNodeInspector` into a composite component using `Tabs` (Shadcn), with sub-components for `FormTab`, `ModelTab`, `ChatTab`.
- **Rationale**: Improves maintainability and performance (lazy rendering of tabs).
- **Alternatives Considered**:
    - *Single massive component*: Rejected due to growing complexity.

### 3. Dynamic Port Logic
- **Decision**: Compute required handles in `RecipeNode.tsx` using `useMemo` based on `model.capabilities`, and pass to `NodeShell`.
- **Rationale**: Reactivity is handled by React's render cycle; avoiding imperative DOM manipulation.

### 4. Model Selection Default
- **Decision**: Use a global/project-level setting for default model.
- **Rationale**: Reduces friction. If no global default, fallback to a system hardcoded default (e.g., a lightweight local model or generic provider).

## Open Questions Resolved

- **Q**: How to handle non-chat models in Chat Tab?
- **A**: Disable the tab visually.

- **Q**: Persistence of Chat History?
- **A**: Persisted in `RecipeAsset` -> `config` -> `chatContext`.
