---
description: "Task list template for feature implementation"
---

# Tasks: Recipe V2 Architecture Upgrade

**Input**: Design documents from `/specs/001-recipe-v2-spec/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md
**Tests**: Unit tests for execution logic and component tests for UI tabs.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create component directories for new Inspector in src/components/workflow/nodes/RecipeNode/Inspector/
- [x] T002 [P] Create empty tab component files (FormTab, ModelTab, ChatTab, AdvancedTab)
- [x] T003 [P] Create/Update test files structure in tests/components/RecipeNode/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Update RecipeAssetConfig interface in src/types/assets.ts with modelConfig and chatContext
- [x] T005 [P] Update RecipeNodeData interface in src/types/project.ts to match new asset config
- [x] T006 [P] Create initial ChatMessage and ModelConfig types in src/types/assets.ts
- [x] T007 [P] Create simple hook useRecipeAsset in src/features/recipes/hooks/useRecipeAsset.ts to ease access to deep config

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Advanced Recipe Configuration (Priority: P1) 🎯 MVP

**Goal**: Users see a 4-Tab Inspector and can save Model configuration.

**Independent Test**: Open Inspector, see tabs, change Model, reload to verify persistence.

### Implementation for User Story 1

- [x] T008 [US1] Refactor src/components/workflow/nodes/RecipeNode/Inspector.tsx to use Shadcn Tabs
- [x] T009 [US1] Implement FormTab.tsx wrapping the existing FormRenderer
- [x] T010 [US1] Implement ModelTab.tsx using ModelConfigurator logic (refactor if needed)
- [x] T011 [US1] Implement AdvancedTab.tsx for raw JSON viewing
- [x] T012 [US1] Connect ModelTab to update asset.config.modelConfig via useRecipeAsset
- [ ] T013 [US1] [TEST] Create component test for Inspector tabs in tests/components/RecipeNode/Inspector.test.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Multi-Turn Agent Interaction (Priority: P2)

**Goal**: Users can chat with the recipe, and execution maintains context.

**Independent Test**: Run recipe, add chat message, verify 2nd run includes history.

### Implementation for User Story 2

- [x] T014 [US2] Implement ChatTab.tsx with MessageList and Input area
- [x] T015 [US2] Implement chatContext persistence in asset.config.chatContext
- [x] T016 [US2] Update src/hooks/useRunRecipe.ts to construct ExecutionContext with history
- [ ] T017 [US2] Update execution logic to append results to chatContext (Assistant messages)
- [ ] T018 [US2] [TEST] Unit test execution flow with history in tests/features/recipes/useRunRecipe.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Dynamic Capability-Based Ports (Priority: P3)

**Goal**: UI adapts to model capabilities (show/hide image ports).

**Independent Test**: Switch model in Inspector, observe port changes on Node.

### Implementation for User Story 3

- [x] T019 [US3] Create utility to check model capabilities in src/features/models/utils.ts
- [x] T020 [US3] Update RecipeNode.tsx to use useMemo for dynamic port generation based on selected model
- [x] T021 [US3] Implement Visual Port Rendering in src/components/workflow/primitives/NodeShell.tsx (if needed support dynamic lists)
- [x] T022 [US3] Disable ChatTab in Inspector.tsx if model lacks 'chat' capability

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T023 [P] Add virtualization to ChatTab message list for performance
- [ ] T024 [P] Verify default model selection logic (FR-007)
- [ ] T025 Run full regression test on existing recipes
- [ ] T026 Update docs/TEP_Recipe_Architecture_2024-12-26.md with implementation details

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational
- **User Story 2 (P2)**: Can start after Foundational (Logic independent of UI tabs, but testing needs UI or mock)
- **User Story 3 (P3)**: Depends on User Story 1 (Model Selection must exist first)

### Parallel Opportunities

- T002 (Files) and T003 (Tests) parallel in Phase 1
- T009, T010, T011 (Tabs) parallel in Phase 3
- T014 (UI) and T016 (Logic) parallel in Phase 4 (if coordinated)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 & 2
2. Implement Phase 3 (Tabs + Model Config)
3. Validate: Can I select a model? Does it save?

### Incremental Delivery

1. Foundation -> US1 (Config) -> US2 (Chat) -> US3 (Dynamic)
2. Each story adds a layer of depth to the "Agent" container concept.
