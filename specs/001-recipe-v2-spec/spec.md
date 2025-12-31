# Feature Specification: Recipe V2 Architecture Upgrade

**Feature Branch**: `001-recipe-v2-spec`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "目前的 RecipeNode 仅实现了一个“动态表单运行器” (V1)，而文档@docs/TEP_Recipe_Architecture_2024-12-26.md 描述的是一个完整的“智能体交互容器” (V2)。这是一次“架构升级”级别的重构,针对这次重构,我们需要制定规范"

## Clarifications

### Session 2025-12-30
- Q: How should the Inspector UI handle the "Chat" tab when the selected model lacks the 'chat' capability? → A: Disable (Grey out) the Chat tab to maintain consistent layout but indicate unavailability.
- Q: What is the default behavior for model selection when a new Recipe Node is created? → A: Default to Global/Project Preference to ensure consistency and reduce setup friction.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Advanced Recipe Configuration (Priority: P1)

Users need a structured interface to configure complex recipes that goes beyond simple form inputs, including model selection and conversation history management.

**Why this priority**: This establishes the foundation for the V2 architecture. Without the ability to configure models and view history, the advanced "Agent" capabilities are inaccessible.

**Independent Test**: Can be tested by opening a Recipe Node and verifying the presence and functionality of the new "4-Tab" Inspector structure (Form, Model, Chat, Advanced), and ensuring configuration persists.

**Acceptance Scenarios**:

1. **Given** a Recipe Node is selected, **When** the user opens the Inspector, **Then** they see four distinct tabs: Form, Model, Chat, and Advanced.
2. **Given** the Model tab, **When** the user selects a specific AI model (e.g., GPT-4), **Then** the selection is saved to the node's configuration.
3. **Given** the Chat tab, **When** the user views the history, **Then** they can see previous interaction messages (system, user, assistant).

---

### User Story 2 - Multi-Turn Agent Interaction (Priority: P2)

Users need to interact with recipes in a conversational manner, refining results through multiple turns rather than just a single "run and done" execution.

**Why this priority**: This transforms the system from a static form runner into a dynamic agent container, a core goal of the V2 upgrade.

**Independent Test**: Can be tested by running a recipe, getting a result, and then adding a follow-up instruction in the Chat tab to update or refine that result.

**Acceptance Scenarios**:

1. **Given** a recipe has been run once, **When** the user enters a follow-up instruction in the Chat tab (e.g., "Make it shorter"), **Then** the recipe re-executes with the conversation context included.
2. **Given** a multi-turn conversation, **When** the execution completes, **Then** the new result updates the output node (e.g., text) or appends to it (e.g., gallery), depending on the defined strategy.

---

### User Story 3 - Dynamic Capability-Based Ports (Priority: P3)

Users need the node interface to automatically adapt based on the selected model's capabilities (e.g., showing an image input port only when a vision-capable model is selected).

**Why this priority**: Improves UX by reducing clutter and prevents errors (connecting images to text-only models).

**Independent Test**: Can be tested by switching between a text-only model and a vision-capable model and observing the appearance/disappearance of the "Reference Image" input handle.

**Acceptance Scenarios**:

1. **Given** a text-only model is selected, **When** the user inspects the node, **Then** no image input port is visible.
2. **Given** the user switches to a vision-capable model (e.g., GPT-4-Vision), **When** the change is confirmed, **Then** a "Reference Image" input port dynamically appears on the node.

### Edge Cases

- What happens when a user switches from a capability-rich model (Vision) to a constrained one (Text-only) while connections exist? (Expectation: Visual warning or graceful disconnection).
- How does the system handle extremely long conversation histories? (Expectation: Token limit truncation or warning).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a `RecipeAssetConfig` structure that includes `modelConfig` (for model selection/params) and `chatContext` (for message history).
- **FR-002**: The Inspector UI MUST implement a 4-Tab layout: Form (business inputs), Model (AI config), Chat (history/interaction), Advanced (system prompt editing). **The Chat tab MUST be disabled (non-interactive) if the selected model lacks the 'chat' capability.**
- **FR-003**: The execution engine MUST support `ExecutionContext` that includes full conversation history, not just current inputs.
- **FR-004**: The system MUST allow recipes to define an "Update" vs "Append" output strategy for multi-turn interactions.
- **FR-005**: Nodes MUST dynamically render input ports/handles based on the currently selected model's declared capabilities (e.g., 'vision' capability triggers image port).
- **FR-007**: **New Recipe Nodes MUST default to the user's global/project-level model preference upon creation.**
- **FR-006**: The Chat interface MUST support referencing existing assets (e.g., via "@" mention or drag-and-drop) to include them in the context.

### Key Entities

- **RecipeAsset**: An extension of RecordAsset that stores not just form data, but also the configuration state of the agent (model, history).
- **ExecutionContext**: The runtime object passed to the executor, containing resolved inputs, history, and model parameters.
- **ModelCapability**: A typed string (e.g., 'vision', 'chat') that defines what a model can do and drives UI adaptations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure a specific AI model for a recipe and have that choice persist across sessions.
- **SC-002**: A recipe can successfully execute a 3-turn conversation (Initial -> Refinement -> Final) without losing context.
- **SC-003**: Switching to a vision model makes the image input port appear in under 200ms (perceived instant).
- **SC-004**: Users can successfully run a recipe that utilizes a provided image input (via dynamic port) to generate a relevant text/image output.