<!--
SYNC IMPACT REPORT
Version Change: 0.0.0 -> 1.0.0 (First Formal Ratification)
Modified Principles:
- Defined I. Code Quality & Consistency
- Defined II. Testing Standards
- Defined III. UX Consistency & Accessibility
- Defined IV. Performance First
Added Sections:
- Architecture & Technology
- Development Workflow
Templates Status:
- .specify/templates/plan-template.md: ✅ Aligns (Constitution Check)
- .specify/templates/spec-template.md: ✅ Aligns (Success Criteria)
- .specify/templates/tasks-template.md: ✅ Aligns (Test tasks included)
Follow-up:
- Ensure all new code adheres to these strict standards immediately.
-->
# Synnia Constitution

## Core Principles

### I. Code Quality & Consistency
Strict adherence to TypeScript is mandatory: no implicit `any`, explicit return types for complex functions. Code must pass all ESLint and formatting checks before strict commit. Naming conventions and directory structures must mirror existing patterns (Feature-based architecture). Comments should explain "why", not "what".

### II. Testing Standards
Critical business logic, complex algorithms (especially graph manipulations), and utility functions must be covered by unit tests (Vitest). New features are not complete without accompanying tests. If a bug is fixed, a regression test must be added to prevent recurrence.

### III. UX Consistency & Accessibility
The User Interface must strictly follow the established Design System (Shadcn UI + Tailwind CSS). Interaction patterns (drag-and-drop, context menus) must be consistent across the Canvas and Panels. All interactive elements should support keyboard navigation and basic accessibility standards.

### IV. Performance First
Zero tolerance for UI blocking or lag. Heavy computations must be offloaded (Web Workers or Rust backend). Large lists and graph nodes must use virtualization. Asset loading must be optimized (lazy loading, caching). Performance regressions in the graph engine are treated as blocking bugs.

## Architecture & Technology

**Stack Requirements**:
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Shadcn UI
- **Desktop Runtime**: Tauri v2
- **State Management**: Zustand (Stores must be atomic and decoupled)
- **Graph Engine**: @xyflow/react
- **Structure**: Domain-driven design (`core/`, `features/`, `components/`). Avoid circular dependencies between features.

## Development Workflow

**Process**:
1. **Spec-First**: Complex features start with the `/speckit.plan` and `/speckit.specify` flow.
2. **TEP Protocol**: Architectural decisions use the Truth Engine Protocol (Red/Blue debate) for validation.
3. **Commit Standards**: Use Conventional Commits (`feat:`, `fix:`, `refactor:`).
4. **Review**: All code changes are verified against this Constitution.

## Governance

This Constitution supersedes all other ad-hoc practices.
- **Amendments**: Require a Pull Request and explicit approval via the Red-Blue Debate protocol.
- **Versioning**: Follows Semantic Versioning (MAJOR.MINOR.PATCH).
- **Compliance**: Continuous Integration (CI) should enforce Principle I (Lint/Type) and Principle II (Tests) automatically where possible.

**Version**: 1.0.0 | **Ratified**: 2025-12-30 | **Last Amended**: 2025-12-30