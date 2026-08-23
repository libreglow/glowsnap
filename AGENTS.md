# AGENTS.md — GlowSnap

Guidance for AI coding agents working in this repository. Before changing
anything, inspect the relevant code and configs. Make the smallest focused
change that preserves the existing architecture.

## Project Overview

GlowSnap is an open-source, **Linux-only** desktop app for screen capture,
screen recording, and visual editing. It is a Wails v2 application: a Go
backend handles native Linux integration (Screenshot/ScreenRecorder D-Bus
portals, system tools), and an embedded React + TypeScript UI renders inside a
WebKitGTK window. Screenshot editing happens on a Konva canvas.

## Tech Stack

- **Backend:** Go 1.25, Wails v2 (pinned `v2.13.0`), `godbus/dbus/v5`,
  `golang.org/x/sys`.
- **Frontend:** React 19, TypeScript 5.9 (strict), Vite 8, Tailwind CSS v4,
  shadcn/ui (`base-nova`, backed by `@base-ui/react`), Konva + react-konva,
  framer-motion, lucide-react.
- **Package manager:** npm is canonical. `frontend/package-lock.json` is the
  authoritative lockfile; CI and the Dockerfile use `npm ci`. A stale `bun.lock`
  exists but is not the source of truth.
- **Formatting:** gofmt for Go (enforced in CI via `gofmt -l .`). No frontend
  formatter or linter is installed.

## Repository Structure

- `main.go` — entry point; embeds `frontend/dist` and `build/appicon.png` via
  `//go:embed`; configures `wails.Run`.
- `app.go` — the Wails-bound `App` type: the **bridge/orchestration layer**
  between the frontend and the backend services.
- `services/` — plain Go packages (`screenshot`, `screencast`, `settings`);
  `ocr/` is empty. No Wails dependency.
- `frontend/` — React/TS app: `src/` (components, hooks, lib, types),
  `index.html`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`,
  `components.json` (shadcn config), and `wailsjs/` (generated bindings).
- `scripts/` — `dev.sh`, `build.sh`, `build-appimage.sh`, `release.sh`,
  `install.sh`, `clean.sh`, `install-deps.sh` (docs in `scripts/README.md`).
- `build/` — app icon, `glowsnap.desktop`, `icons/hicolor` theme; `bin/` and
  `AppImage/` hold build output.
- `packaging/` — Flatpak manifest, desktop file, icon, metainfo.
- `Dockerfile` — reproducible multi-stage Linux build + test environment.
- `.github/workflows/` — `ci.yml` (backend + frontend checks) and `release.yml`.
- `third_party/wails` — vendored/local fork of the Wails module, wired via
  `replace github.com/wailsapp/wails/v2 => ./third_party/wails`.
- `docs/`, `README.md`, `CONTRIBUTING.md`.

## Architecture

The intended data flow is:

```text
React frontend
      ↓
Generated Wails bindings (frontend/wailsjs)
      ↓
App methods in app.go
      ↓
Services / native Linux integrations (services/)
```

The frontend calls backend methods through the generated bindings in
`frontend/wailsjs/go/main/App`; backend → frontend events flow through
`runtime.EventsEmit` / `EventsOn` (e.g. `recording-started`,
`recording-ended`, `toggle-palette`). Do not bypass this architecture without a
clear reason.

- **Window modes** are a union type (`palette | studio | closed | recording |
  settings | preferences | overlay`) managed in `App.tsx` through local state
  and passed to components as props. Corresponding `ResizeTo*` methods on `App`
  resize the native window.
- **Capture** uses the org.freedesktop.portal Screenshot API over D-Bus in
  `services/screenshot`; **recording** uses the ScreenRecorder portal plus a
  GStreamer pipeline in `services/screencast`.
- **Settings** live in `services/settings`: JSON at
  `~/.config/glowsnap/settings.json`, loaded with defaults-merge +
  normalization, saved atomically via a `.tmp` file + rename.
- **Screenshots** saved to the settings save-directory are served to the UI by
  a loopback `127.0.0.1` HTTP server started in `App.startup`; the frontend
  loads image URLs from `GetScreenshotsBaseURL()`.
- **Editor** renders a Konva stage driven by the `ShapeConfig` model
  (`src/types/types.ts`), with history via `useHistory`.

### app.go vs services/

- `app.go` should remain primarily the Wails bridge/orchestration layer. Avoid
  dumping unrelated business logic into it.
- Put reusable functionality in the appropriate `services/` package.
- `services/` packages must stay plain Go and must **not** depend on Wails
  runtime APIs. Wails-specific concerns belong in `app.go` / `main.go`.
- Do not duplicate service functionality inside `app.go`.
- Add an exported method to `App` only when functionality genuinely needs to be
  exposed to the frontend; let Wails regenerate the bindings rather than
  editing `frontend/wailsjs` by hand.
- Keep services independently testable where practical, and do not introduce
  abstractions the current project does not need.

## Change Scope

- Inspect the relevant implementation before changing it.
- Identify the files directly related to the task and touch only those.
- Make the smallest reasonable change.
- Avoid unrelated cleanup and unrelated refactoring.
- Do not rename or reorganize files unless required.
- Do not replace working libraries or architectural patterns without a clear
  reason.
- Do not modify unrelated configuration.
- Do not remove existing functionality unless explicitly requested.
- Preserve existing behavior outside the requested change.
- If a broader architectural change appears necessary, explain why before
  making it; do not "improve" unrelated code merely because you encounter it.

## Frontend Guidelines

- **Components:** feature folders under `src/components/` (e.g. `editor/`,
  `settings/`) plus shared UI primitives in `src/components/ui/`. Reusable
  primitives use `cva` (class-variance-authority) + `cn()` from `src/lib/utils.ts`.
- **State:** local `useState`/`useRef`/`useCallback`; reusable logic lives in
  custom hooks under `src/lib/hooks/` (`useDrawing`, `useHistory`, `useShapes`,
  `useCrop`, `useTextEditing`, `useBackground`, `useKeyboardShortcut`). There
  is no global state store. Avoid creating a state-management library or global
  store for isolated problems; prefer existing hooks and component patterns.
- **Types:** centralize in `src/types/types.ts`; re-export Wails model types
  from `frontend/wailsjs/go/models`.
- **Styling:** Tailwind CSS v4 utilities + CSS variables in `src/index.css`;
  icons from `lucide-react`; motion via `framer-motion`.
- **Backend calls:** import generated functions from
  `frontend/wailsjs/go/main/App` and runtime helpers/events from
  `frontend/wailsjs/runtime/runtime`. Never hand-edit `frontend/wailsjs`.
- Keep large components from accumulating unrelated business logic when an
  existing hook/service abstraction is more appropriate.

## Backend Guidelines

- `services/` packages are plain Go and must not depend on Wails; only
  `app.go` and `main.go` use Wails.
- Follow the existing error/logging style: return `(value, error)` and log
  failures with `runtime.LogInfo` / `runtime.LogError` (Wails layer only).
- Concurrency uses `sync.Mutex` (app.go) and channel semaphores
  (`services/screencast`).
- Reuse the existing settings system; do not replace it with a new persistence
  mechanism without a clear reason.

## Testing

- The repository currently has **no actual test files** (Go or frontend). Do
  not claim a test suite exists.
- Backend validation is `go test -tags webkit2_41 ./...` and `go vet -tags
  webkit2_41 ./...` (as CI runs). In the current state these act primarily as
  compilation/package validation.
- `npm run build` is the primary frontend validation (runs `tsc`, then Vite
  build).
- `vitest.config.ts` exists, but there is **no** `test` script and the
  referenced `src/test-setup.ts` is missing, so vitest is not a runnable
  workflow. Do not present it as such.
- Do not invent test, build, lint, or formatting commands.

## Build and Validation

Use the smallest relevant validation for the change:

```bash
# Frontend type-check + build (primary frontend validation)
cd frontend && npm run build

# Go formatting check (must output nothing)
gofmt -l .
# Go compile/test validation
go test -tags webkit2_41 ./...
# Go static validation
go vet -tags webkit2_41 ./...

# Full application build (builds frontend, then Wails backend) -> build/bin/glowsnap
./scripts/build.sh

# Development environment (Vite HMR + Go hot reload)
./scripts/dev.sh
```

Docker (reproducible Linux build + tests):

```bash
docker build -t glowsnap:build .                                  # build + test (as CI does)
docker build --target artifacts -o out/ .                         # export only the binary
docker run --rm glowsnap:build go test -tags webkit2_41 ./...     # run tests in container
```

Building locally requires WebKitGTK 4.1 + GTK3 dev libraries (see
`./scripts/install-deps.sh`). Other maintenance scripts: `./scripts/clean.sh`
(remove generated output), `./scripts/build-appimage.sh`,
`./scripts/release.sh <version> <channel>`. See `scripts/README.md`.

Do not run expensive full builds for trivial documentation-only changes unless
necessary, and never claim something was tested unless you actually ran it.

## Generated Files

- **`frontend/wailsjs/`** — generated Wails bindings. **Never manually edit.**
  To change a binding, modify its source in `app.go` (or the relevant backend
  model/API) and let Wails regenerate them via the normal workflow
  (`wails dev` / `wails build`). Do not patch generated output by hand.
- **`frontend/dist/`** — build output, not source. The Go binary embeds it via
  `//go:embed all:frontend/dist`, so build the frontend before any full
  application build. Do not hand-edit generated assets.
- **Other generated/build output:** `build/bin`, `build/AppImage`,
  `frontend/dist`, `release/`, and `out/` are gitignored build artifacts; do
  not treat them as source or commit them.

## Git Guidelines

- Do not create commits or push unless explicitly requested.
- Never force-push.
- Never perform destructive `git reset`, destructive checkout operations, or
  rebase without explicit approval.
- Never delete or overwrite existing user changes; do not silently discard work.
- Check `git status` when relevant and review the final diff after changes.
- Use the repository's established commit convention (conventional commits such
  as `feat:`/`fix:`/`refactor:`/`docs:`) only when a commit is explicitly
  requested.

## Linux-Specific Rules

GlowSnap is Linux-only and this is intentional:

- D-Bus portals, WebKitGTK, and GTK dependencies are intentional.
- `xdg-open`, clipboard utilities (`wl-copy`/`xclip`/`xsel`), and Linux system
  APIs (e.g. `unix.Statx` for file birth time) are intentional.
- Wayland/X11-specific behavior exists.
- Do not replace these Linux-native integrations with cross-platform
  alternatives merely for portability.
- Do not add Windows/macOS support unless explicitly requested.
- Do not assume a different desktop environment behaves a certain way unless
  the repository documents it.

## Workflow

1. Inspect the repository and read the relevant files before changing anything.
2. Identify the actual root cause/requirement.
3. Find existing services, hooks, components, or utilities to reuse.
4. Make the smallest appropriate change in the right layer.
5. Run the most relevant validation (formatting, type-check, tests, build).
6. Review the final diff and confirm no unrelated files changed.
7. Report what changed and how it was validated.