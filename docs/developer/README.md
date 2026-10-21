# Developer Documentation

Documentation for people who want to build, run, extend or contribute to
GlowSnap.

GlowSnap is a [Wails v2](https://wails.io) desktop application: a Go backend
handles the native Linux integration, and an embedded React + TypeScript UI
runs inside a WebKitGTK window.

---

## Guides

| Guide | What it covers |
| ----- | -------------- |
| [Architecture](./architecture.md) | The layers, the data flow and the rules that keep the project tidy |
| [Repository layout](./repository-layout.md) | Every important file and what it does |
| [Getting started](./getting-started.md) | Toolchain, dependencies and the development loop |
| [Backend](./backend.md) | `app.go`, the `services/` packages, D-Bus, GStreamer and the settings system |
| [Frontend](./frontend.md) | The React app, window modes, hooks, the Konva editor model |
| [Testing](./testing.md) | The `tests/` tree, the runner scripts and how to write new tests |
| [Building & releasing](./building.md) | Binaries, AppImage, Flatpak, Docker and the release pipeline |
| [Linux integration](./linux-integration.md) | Portals, Wayland/X11, clipboard, audio, notifications |
| [Contributing](./contributing.md) | Workflow, commit style and the code guidelines |

The project-wide rules that every agent and contributor must follow also live
in [`AGENTS.md`](../../AGENTS.md) at the repository root.

---

## The 60-second version

```text
React frontend
      ↓
Generated Wails bindings (frontend/wailsjs)
      ↓
App methods in app.go
      ↓
Services / native Linux integrations (services/)
```

- `app.go` is the **bridge** between the UI and the backend. It orchestrates;
  it does not hold business logic.
- `services/` holds the reusable logic and **must not import Wails**.
- `frontend/wailsjs/` is **generated**. Never edit it by hand — change `app.go`
  and let Wails regenerate the bindings.
- All tests live in the top-level `tests/` folder.
- `./test.sh` is the single validation command, and it is exactly what CI runs.

---

## Quick reference

```bash
# Validate everything (frontend + backend) — same as CI
./test.sh

# One half only
./test.sh frontend
./test.sh backend

# Development environment (Vite HMR + Go hot reload)
./scripts/dev.sh

# Production build -> build/bin/glowsnap
./scripts/build.sh
```
