# Implementation Plan: Recipe V2 Architecture Upgrade

**Branch**: `001-recipe-v2-spec` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-recipe-v2-spec/spec.md`

## Summary

This feature implements the V2 architecture for Recipe Nodes, transforming them from static form runners into dynamic, multi-turn AI agent containers. Key changes include a 4-Tab Inspector UI (Form, Model, Chat, Advanced), persistent conversation history (Chat Context), and dynamic capability-based ports (e.g., image inputs for vision models).

## Technical Context

**Language/Version**: TypeScript 5.x (Frontend), Rust 1.7x (Backend/Tauri)
**Primary Dependencies**: React 19, @xyflow/react (Graph), Zustand (State), Radix UI (Components)
**Storage**: Local JSON files (Asset Store), leveraging Tauri file system API
**Testing**: Vitest (Unit/Integration), React Testing Library
**Target Platform**: Desktop (macOS/Windows/Linux) via Tauri
**Project Type**: Desktop App (Local-first)
**Performance Goals**: <200ms for dynamic port rendering; zero-lag typing in Chat UI
**Constraints**: Must maintain backward compatibility for existing recipes; strictly local execution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality**: Will use strict TypeScript types for `RecipeAssetConfig`, `ExecutionContext`.
- **II. Testing Standards**: Will add Vitest unit tests for `useRunRecipe` (execution logic) and `Inspector` state logic.
- **III. UX Consistency**: Inspector UI will use standard Shadcn tabs and components.
- **IV. Performance**: Chat history will be virtualized if long; updates to node ports will be optimized to avoid full graph re-render.

## Project Structure

### Documentation (this feature)

```text
specs/001-recipe-v2-spec/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── features/recipes/           # Domain Logic
│   ├── components/             # Recipe-specific UI (Inspector Tabs)
│   ├── hooks/                  # Execution Hooks (useRunRecipe)
│   └── types.ts                # Type Definitions
├── components/workflow/nodes/RecipeNode/ # Node UI
├── store/                      # Asset/Node Store (Zustand)
└── types/                      # Shared Types (assets.ts)

tests/
├── features/recipes/           # Unit Tests for Recipe Logic
└── components/RecipeNode/      # Component Tests
```

**Structure Decision**: Adhering to the existing Feature-based architecture (`src/features/recipes`) and Component-based node structure.