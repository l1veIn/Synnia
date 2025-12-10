# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript UI: `components/` shared UI pieces, `pages/` route shells, `store/` Zustand state, `lib/engine` graph/canvas logic, `bindings/` generated TS surfaces (regen after backend changes).
- `public/` holds static assets (e.g., banners and icons used in marketing views); `index.html` is the Vite entry.
- `src-tauri/` hosts the Rust backend: commands in `src/commands`, models/config in `models.rs` and `tauri.conf.json`, generated bindings in `bindings/`, and schema outputs in `gen/`.

## Build, Test, and Development Commands
- Install deps with `npm install` (keep `package-lock.json` in sync; use `pnpm` only if you also maintain `pnpm-lock.yaml`).
- `npm run dev` starts the Vite UI; `npm run tauri:dev` launches the desktop shell with the same front-end.
- `npm run build` type-checks via `tsc` then bundles; `npm run tauri:build` produces production desktop binaries.
- `npm run lint` runs ESLint (TS + React Hooks + Refresh); fix or silence `_`-prefixed unused vars before pushing.
- `npm run gen:types` regenerates TS bindings after modifying Rust commands or models in `src-tauri`.

## Coding Style & Naming Conventions
- TypeScript + React 19 with functional components and hooks; prefer colocation of UI + logic per feature folder.
- Match existing 2-space indentation and double quotes; use `camelCase` for functions/vars and `PascalCase` for components or store hooks (`useXStore`).
- Lean on Tailwind utility classes; extend design tokens via CSS variables in `src/index.css` and `tailwind.config.ts`.

## Testing Guidelines
- Vitest is available; colocate unit tests as `*.test.ts` or `*.test.tsx` near the module.
- Focus coverage on pure logic in `src/lib/**/*` and store transitions in `src/store/**/*`; mock Tauri bridges when present.
- Run `npm exec vitest` (or `pnpm vitest`) locally; add `--watch` for quick iteration.

## Commit & Pull Request Guidelines
- Use Conventional Commits as in history (`feat(scope): ...`, `docs: ...`, `fix: ...`); keep commits scoped and descriptive.
- PRs should include a short purpose summary, screenshots for UI-facing changes, linked issues, and a checklist of commands run (`lint`, relevant tests, builds when touching Tauri).
- Keep front-end and Rust updates coordinated: declare new capabilities in `src-tauri/tauri.conf.json` and regenerate bindings so `src/bindings` stays accurate.

## Security & Configuration Tips
- Avoid committing real assets with personal data; prefer placeholders under `public/assets`.
- When adding native features, review `src-tauri/capabilities` and `tauri.conf.json` so file-system or dialog access stays explicit and minimal.***
