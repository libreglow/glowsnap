---
name: glowsnap-architecture
description: GlowSnap's end-to-end architecture and data flow, including the app.go bridge, plain-Go services, generated Wails bindings, and the embedded frontend. Use when working across multiple layers, adding backend-to-frontend features, or before touching a new area of the codebase.
---

# GlowSnap Architecture

## Purpose

Explain how GlowSnap is organized so agents place changes in the correct layer
and preserve the existing Wails architecture.

## When to use

- Starting work on any feature that spans the backend and frontend.
- Adding a new backend method, event, or binding.
- Understanding where a change belongs before editing code.

## Architecture / Context

GlowSnap is a Wails v2 desktop app for Linux. A Go backend handles native
integration and an embedded React/TypeScript UI renders in a WebKitGTK window.
The intended data flow is one-way:

```text
React frontend
      ↓
Generated Wails bindings (frontend/wailsjs)
      ↓
App methods in app.go
      ↓
Services / native Linux integrations (services/)
```

For full reference, read `AGENTS.md` at the repository root (project-wide rules
and constraints) before making changes.

### Layers

- `main.go` — entry point. Embeds `frontend/dist` and `build/appicon.png` via
  `//go:embed` and configures `wails.Run` (window size, transparency, Linux
  options, `Bind: app`).
- `app.go` — defines the Wails-bound `App` type. This is the
  **bridge/orchestration layer**: window resizing, capture/recording
  orchestration, settings access, file operations, and the loopback HTTP server
  that serves saved screenshots to the UI. Every exported method becomes a
  binding callable from the frontend.
- `services/` — plain Go packages (`screenshot`, `screencast`, `settings`).
  These contain the reusable logic and must **not** depend on Wails. `ocr/` is
  empty.
- `frontend/` — the React/TS app. `App.tsx` manages top-level `WindowMode`
  state; components live under `src/components/`; hooks under `src/lib/hooks/`.
- `frontend/wailsjs/` — **generated Wails bindings. Never edit by hand**; they
  are regenerated from `app.go` by `wails dev` / `wails build`.

## Rules

- Keep `app.go` primarily the bridge/orchestration layer; put reusable logic in
  `services/`. Do not make `app.go` a dumping ground.
- `services/` must stay plain Go and must not import `github.com/wailsapp`.
- Add an exported method to `App` only when functionality genuinely needs to be
  exposed to the frontend; let Wails regenerate the bindings.
- Backend → frontend events use `runtime.EventsEmit` / `EventsOn` (e.g.
  `recording-started`, `recording-ended`, `toggle-palette`).
- `frontend/dist` is embedded into the Go binary, so the frontend must be built
  before any full application build.
- Always use the `webkit2_41` build tag for Go builds/tests, matching CI and
  `scripts/`.
- npm is the canonical package manager; `frontend/package-lock.json` is
  authoritative (do not treat the stale `bun.lock` as the source of truth).

## Workflow

1. Read `AGENTS.md` and any process/spec docs.
2. Determine which layer owns the change; inspect the existing equivalent
   (method, event, hook, component) before writing new code.
3. Add reusable logic to the appropriate `services/` package; reference it from
   `app.go`; expose a thin binding only if the frontend needs it.
4. Build the frontend, then the binary, using the validation in `AGENTS.md`.

## Common mistakes

- Putting business logic directly in `app.go` instead of `services/`.
- Hand-editing `frontend/wailsjs`.
- Adding a binding when the frontend can already reach the data via an
  existing method or event.
- Bypassing the one-way architecture with direct frontend→native calls.

## Validation

- `services/` packages import no Wails packages.
- New App methods are accompanied by regenerated bindings, not manual edits.
- `gofmt -l .` is empty and `npm run build` (in `frontend/`) passes.