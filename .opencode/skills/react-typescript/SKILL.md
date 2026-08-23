---
name: react-typescript
description: GlowSnap's frontend conventions — React 19, strict TypeScript, Tailwind CSS v4, shadcn/ui primitives, the views-in-App.tsx window mode pattern, hooks library, and the wailsjs import boundary. Use when changing any frontend component, hook, type, or style.
---

# GlowSnap React / TypeScript

## Purpose

Document how the GlowSnap frontend is structured so changes follow its existing
component, state, styling, and typing conventions instead of inventing new ones.

## When to use

- Editing `frontend/src/**` (components, hooks, lib, types, styles).
- Adding a new UI component, hook, or reusable primitive.
- Working with `App.tsx` window modes or controller components.

## Architecture / Context

The frontend is a React 19 + TypeScript (strict) app built with Vite 8, styled
with Tailwind CSS v4, using shadcn/ui primitives (`base-nova` style backed by
`@base-ui/react`), lucide-react icons, and framer-motion for animation.
The editor surface uses Konva + react-konva (see `glowsnap-editor`).

- **App entry:** `src/main.tsx` mounts `App` into `#root` under
  `React.StrictMode`.
- **Window modes:** `App.tsx` holds the top-level `WindowMode` union
  (`palette | studio | closed | recording | settings | preferences | overlay`)
  via local state and renders the matching controller component
  (`Palette`, `Studio`, `RecordingSettings`, `SettingsPanel`, `RecordingBar`,
  `Overlay`). Corresponding `ResizeTo*` backend calls resize the native window.
- **Components** live under `src/components/` (feature folders like `editor/`,
  `settings/`) plus shared UI primitives in `src/components/ui/`.
- **Hooks** live under `src/lib/hooks/` (`useDrawing`, `useHistory`,
  `useShapes`, `useCrop`, `useTextEditing`, `useBackground`,
  `useKeyboardShortcut`) and `src/lib/` (`shortcut.ts`, `customFonts.tsx`,
  `viewport.ts`, `utils.ts`).
- **Types** are centralized in `src/types/types.ts`, re-exporting Wails model
  types from `frontend/wailsjs/go/models` (e.g. `main.ScreenshotInfo`,
  `settings.Settings`).

## Rules

- **There is no global state store.** Prefer local `useState`/`useRef`/
  `useCallback` and existing hooks. Do not introduce a state-management
  library or a global store for an isolated problem.
- Thread shared/current "mode" through `App.tsx` props, like every existing
  controller does.
- Reuse existing hooks and component patterns; keep large components from
  accumulating unrelated business logic when a hook/service abstraction is more
  appropriate.
- Use Tailwind CSS v4 utilities + CSS variables in `src/index.css`; do not add
  a separate CSS-in-JS or legacy Tailwind config path.
- Use icons from `lucide-react` and motion from `framer-motion`.
- Reusable UI primitives use `cva` (class-variance-authority) + `cn()` from
  `src/lib/utils.ts`; reuse existing primitives in `src/components/ui/`.
- Path alias `@/*` maps to `src/*` (configured in `tsconfig.json` and
  `vite.config.ts`); imports of `@/...` are preferred over deep relative paths.
- Import backend functions from `frontend/wailsjs/go/main/App` only; use
  `@/types/types.ts` for shared types. Never hand-edit `frontend/wailsjs`.
- TypeScript is strict; fix type errors rather than casting where avoidable.

## Workflow

1. Read the nearest existing component/hook to mirror its pattern.
2. Decide where state and logic live (component-local vs. a reusable hook under
   `src/lib/hooks/`).
3. Use `cn()` for class composition and Tailwind utilities for styling.
4. Type-check/build with `npm run build` in `frontend/` (runs `tsc`, then Vite
   build).

## Common mistakes

- Adding a global store or state library for a scoped problem.
- Duplicating logic that already exists in a hook or `src/lib/`.
- Hand-editing `frontend/wailsjs`.
- Deep relative imports instead of `@/` aliases.
- Adding a new UI primitive where an existing `src/components/ui/*` suffices.
- Bypassing `App.tsx` window-mode ownership.

## Validation

- `npm run build` (in `frontend/`) passes the `tsc` type-check.
- New shared logic lives in hooks/`src/lib` and is reused, not duplicated.
- No global store or hand-edited `wailsjs` added.