---
name: wails-v2
description: How the Wails v2 application framework is used in GlowSnap — the app.go bridge, main.go options, generated bindings, runtime events, the webkit2_41 build tag, and the vendored third_party/wails fork. Use when adding backend methods, bindings, events, window control, or modifying Wails-related code.
---

# Wails v2 in GlowSnap

## Purpose

Explain how GlowSnap uses Wails v2 so agents correctly add bindings, events, and
window behavior without breaking the generated-binding workflow or the
vendored fork.

## When to use

- Adding a new backend method that the frontend must call.
- Sending/consuming backend→frontend events.
- Resizing/controlling the native window from the frontend.
- Reading or reasoning about `main.go`, `app.go`, or `frontend/wailsjs/`.

## Architecture / Context

GlowSnap is a **Wails v2** app pinned at `v2.13.0` in `go.mod` with
`replace github.com/wailsapp/wails/v2 => ./third_party/wails`. The Wails
runtime bridges a Go backend to the embedded React/TS frontend.

- **`main.go`** — `wails.Run(&options.App{...})`: sets window title/size,
  `Frameless: true`, `AlwaysOnTop`, translucent background, Linux options
  (`WindowIsTranslucent`, `WebviewGpuPolicy`, icon), `OnStartup: app.startup`,
  and `Bind: []interface{}{app}`. The frontend assets are embedded from
  `frontend/dist` via `//go:embed all:frontend/dist`.
- **`app.go`** — the `App` type. Its **exported methods are the backend API**
  the frontend can call. Wails generates bindings from these into
  `frontend/wailsjs/` on `wails dev` / `wails build`.
- **`frontend/wailsjs/`** — generated bindings. Never edit by hand.
  - `go/main/App` — TS functions for each `App` method.
  - `go/models` — generated model types shared with the frontend.
  - `runtime/` — runtime helpers (`EventsOn`, `EventsEmit`, `WindowSetSize`,
    dialog/notification functions, etc.).
- **Runtime events:** backend emits with `runtime.EventsEmit`, frontend
  subscribes with `runtime.EventsOn` (e.g. `recording-started`,
  `recording-ended`, `toggle-palette`).
- **Window modes:** `App.tsx` holds a `WindowMode` union and calls
  `ResizeToPalette/Studio/Settings/Preferences` (App methods that call
  `runtime.WindowSetSize`, `WindowMaximise`, `WindowCenter`, etc.).

## Rules

- **Never manually edit `frontend/wailsjs/`.** To change a binding, change the
  Go source (method signature on `App`, or the backend model type) and let
  Wails regenerate via `wails dev`/`wails build`.
- **Never modify `third_party/wails`** unless explicitly asked in a task that
  targets the fork. It is a vendored local fork, not project code.
- Only add an exported method to `App` when the frontend genuinely needs it;
  keep `app.go` a thin bridge (see `glowsnap-architecture`).
- Always build/test Go with the **`webkit2_41`** build tag, matching CI and the
  scripts (`wails build -tags webkit2_41`, `go test -tags webkit2_41 ./...`).
- Build the frontend before any full Wails build because the binary embeds
  `frontend/dist`.
- Use `runtime.LogInfo`/`runtime.LogError` for backend logging at the Wails
  layer.
- Wails-specific code belongs in `app.go`/`main.go`; keep `services/` free of
  Wails imports.

## Workflow

1. Add reusable logic to a `services/` package.
2. Add a (thin) exported method on `App` in `app.go` only if the frontend needs
   it; return plain JSON-able values so bindings are clean.
3. Run `wails dev`/`wails build` (or `./scripts/build.sh`) so `frontend/wailsjs`
   regenerates, then use the new functions from the frontend.
4. For async backend→frontend updates, emit events with `runtime.EventsEmit`
   and subscribe via `EventsOn`.

## Common mistakes

- Hand-editing generated `wailsjs` files.
- Modifying `third_party/wails` during normal feature work.
- Forgetting the `webkit2_41` tag, causing link/build failures on Linux.
- Building the binary without building the embedded `frontend/dist`
  first.
- Importing Wails packages inside `services/`.
- Returning non-JSON-able structs/types from `App` methods (breaks bindings).

## Validation

- New/edited App methods appear as regenerated bindings under
  `frontend/wailsjs/go/main/App` (not hand-written).
- `go vet -tags webkit2_41 ./...` and `go test -tags webkit2_41 ./...` pass.
- `services/` contains no Wails imports.
- `npm run build` (in `frontend/`) passes.