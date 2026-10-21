# Repository Layout

```text
glowsnap/
├── main.go                  # entry point: embeds assets, configures wails.Run
├── app.go                   # the Wails bridge / orchestration layer
├── go.mod / go.sum          # Go module "glowsnap", replace -> ./third_party/wails
├── wails.json               # Wails project configuration
├── AGENTS.md                # project-wide rules for agents and contributors
├── CONTRIBUTING.md          # contribution guide
├── README.md                # project overview
├── test.sh                  # the single validation entry point
├── Dockerfile               # reproducible build + test environment
│
├── services/                # plain Go, no Wails dependency
│   ├── screenshot/          # Screenshot portal, naming, cropping
│   ├── screencast/         # ScreenCast portal, GStreamer, audio, thumbnails
│   ├── settings/            # settings structs, defaults, normalisation, JSON
│   └── notification/        # desktop notifications with image attachment
│
├── frontend/                # React + TypeScript application
│   ├── src/
│   │   ├── App.tsx          # window mode state machine
│   │   ├── main.tsx         # React entry point
│   │   ├── components/      # feature components + ui/ primitives
│   │   ├── lib/             # hooks, helpers, shortcut registry
│   │   ├── types/           # shared TypeScript types
│   │   └── index.css        # Tailwind entry point + CSS variables
│   ├── wailsjs/             # GENERATED bindings — never edit
│   ├── package.json         # npm scripts and dependencies
│   ├── vite.config.ts       # Vite config (@ alias)
│   ├── vitest.config.ts     # Vitest config (jsdom, absolute aliases)
│   ├── tsconfig.json        # app sources
│   ├── tsconfig.test.json   # test sources
│   └── components.json      # shadcn/ui configuration
│
├── tests/                   # ALL test code (own Go module: tests/go.mod)
│   ├── backend/             # Go tests, symlinked into each package
│   │   ├── app_test.go
│   │   └── services/<pkg>/*_test.go
│   └── frontend/            # Vitest suites, setup, Wails mocks
│       ├── test-setup.ts
│       ├── test-support/wails.ts
│       └── components/, lib/
│
├── scripts/                 # developer + maintenance scripts (see scripts/README.md)
│   ├── dev.sh               # wails dev with HMR
│   ├── build.sh             # production build -> build/bin/glowsnap
│   ├── build-appimage.sh    # AppImage packaging
│   ├── release.sh           # collect release artifacts + checksums
│   ├── install.sh           # install into the desktop environment
│   ├── install-deps.sh      # detect distro, report/install dependencies
│   ├── clean.sh             # remove generated artifacts
│   ├── test-frontend.sh     # lint, typecheck, vitest, build
│   └── test-backend.sh      # gofmt, go vet, go test
│
├── build/                   # app icon, .desktop file, hicolor icon theme
├── packaging/               # Flatpak manifest, desktop entry, metainfo
├── docs/                    # documentation
│   ├── images/              # screenshots used by the README and the docs
│   ├── user/                # end-user documentation
│   └── developer/           # this documentation
│
├── third_party/wails/       # vendored Wails fork (replace directive)
└── .github/workflows/       # ci.yml, release.yml
```

---

## Backend files

| File | Purpose |
| ---- | ------- |
| `main.go` | Embeds `frontend/dist` and `build/appicon.png`, starts Wails with a frameless, translucent, always-on-top window and `WebviewGpuPolicyAlways` |
| `app.go` | The `App` type: window resizing, capture orchestration, recording orchestration, settings access, file operations, the loopback HTTP server |

### `services/screenshot/screenshot.go`

| Symbol | Purpose |
| ------ | ------- |
| `Service` | Wraps a `*dbus.Conn` |
| `CaptureFullScreen()` | Portal screenshot with `interactive=false` |
| `CaptureArea()` | Portal screenshot with `interactive=true` |
| `CropRegion(path, x, y, w, h)` | Decodes the PNG, intersects the region with the image bounds and re-encodes in place |
| `buildScreenshotName(pattern)` | Expands `{date}` and strips characters that are illegal in file names |

### `services/screencast/`

| File | Purpose |
| ---- | ------- |
| `screencast.go` | Portal session lifecycle: `CreateSession` → `SelectSources` → `Start`, cursor mode, stream parsing, start/stop detection |
| `recorder.go` | The GStreamer pipeline (`buildPipelineArgs`), encoding profiles, pause/resume/stop/cancel via process signals |
| `audio.go` | `pactl` based device listing, default microphone, system monitor source, live mute/unmute |
| `paths.go` | Output file name and the recordings directory |
| `settings.go` | Thin wrappers over `services/settings` for the recording keys |
| `thumbnail.go` | Background `ffmpeg` thumbnail generation |

### `services/settings/`

| File | Purpose |
| ---- | ------- |
| `settings.go` | The `Settings` structs, defaults, `Load`/`Save`/`ResetToDefaults`, defaults merging, normalisation |
| `resolution.go` | Resolution presets, custom resolution limits and validation |

### `services/notification/notification.go`

`Send(conn, title, body, imagePath)` — sends a notification over
`org.freedesktop.Notifications`, attaching the capture as `image-path` and as
`image-data` (scaled to 1024 px, RGBA8). If the image hints fail, it retries
with a plain text notification so the message still appears.

---

## Frontend files

| Path | Purpose |
| ---- | ------- |
| `src/App.tsx` | Window mode state machine, Wails event subscriptions, global keyboard handling |
| `src/components/Palette.tsx` | The floating palette (capture, record, studio, settings) |
| `src/components/Studio.tsx` | Screenshot gallery: search, sort, favourites, rename, delete, pagination |
| `src/components/Record.tsx` | Recording gallery and the built-in video player |
| `src/components/SettingsPanel.tsx` | The preferences window shell |
| `src/components/settings/sections.tsx` | The individual settings sections |
| `src/components/settings/primitives.tsx` | Toggle, Select, NumberInput, PathPicker, SettingRow primitives |
| `src/components/Overlay.tsx` | The fullscreen area-selection overlay |
| `src/components/RecordingSettings.tsx` | Per-recording audio/cursor options |
| `src/components/RecordingBar.tsx` | The in-recording control bar |
| `src/components/editor/Editor.tsx` | The editor shell: tools, styles, keyboard, export |
| `src/components/editor/Canvas.tsx` | The Konva stage and all shape interaction |
| `src/components/editor/Toolbar.tsx` | The tool palette |
| `src/components/editor/OptionsBar.tsx` | Colour, stroke, opacity and text options |
| `src/components/editor/FloatingToolbar.tsx` | Per-shape quick actions |
| `src/components/editor/BackgroundControls.tsx` | Gradient background controls |
| `src/components/editor/InlineTextEditor.tsx` | The DOM overlay used for text editing |
| `src/components/editor/FontPicker.tsx` | Font family picker |
| `src/lib/shortcut.ts` | The central shortcut registry, matching and rebinding helpers |
| `src/lib/hooks/*` | `useShapes`, `useDrawing`, `useCrop`, `useTextEditing`, `useBackground`, `useHistory`, `useKeyboardShortcut` |
| `src/lib/viewport.ts` | Zoom/pan helpers for the Konva stage |
| `src/lib/resolution.ts` | Resolution parsing and validation shared with the backend |
| `src/types/types.ts` | Shared types, including `ShapeConfig` and `WindowMode` |
| `src/components/ui/*` | shadcn/ui-style primitives (`button`, `toggle`, `slider`, `scroll-area`, `media-card`) |

---

## Generated and build output

These paths are **not** source and must never be committed:

| Path | What it is |
| ---- | ---------- |
| `frontend/wailsjs/` | Generated Wails bindings |
| `frontend/dist/` | Vite build output, embedded into the Go binary |
| `build/bin/` | Compiled binary |
| `build/AppImage/` | Packaged AppImage |
| `release/` | Local release artifacts |
| `out/` | Docker export target |
| `third_party/wails/` | Vendored Wails module (checked in on purpose — the `replace` directive points at it) |
