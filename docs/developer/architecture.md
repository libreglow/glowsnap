# Architecture

## Layers

GlowSnap is a Wails v2 application for Linux. A Go backend handles native
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

| Layer | Files | Responsibility |
| ----- | ----- | -------------- |
| **Entry point** | `main.go` | Embeds `frontend/dist` and `build/appicon.png`, configures `wails.Run`, binds the `App` |
| **Bridge** | `app.go` | Exposes methods to the UI, orchestrates services, manages the window and the loopback HTTP server |
| **Services** | `services/*` | Reusable logic: capture, recording, settings, notifications. Plain Go, no Wails |
| **Frontend** | `frontend/src` | React UI, window modes, editor canvas, hooks |
| **Bindings** | `frontend/wailsjs` | Generated. Never edit by hand |

---

## The bridge layer (`app.go`)

`App` is the object bound to Wails in `main.go`:

```go
Bind: []interface{}{ app }
```

Every exported method on `App` becomes a callable binding in
`frontend/wailsjs/go/main/App`. The type is grouped roughly as follows:

| Group | Examples |
| ----- | -------- |
| Window control | `ResizeToPalette`, `ResizeToStudio`, `ResizeToRecord`, `ResizeToSettings`, `ResizeToPreferences` |
| Capture | `TakeScreenshot`, `TakeAreaScreenshot`, `StartPaletteAreaCapture`, `CompletePaletteAreaScreenshot`, `CancelPaletteAreaCapture` |
| Recording | `StartRecording`, `PauseRecording`, `ResumeRecording`, `StopRecording`, `CancelRecording`, `SetMicEnabled`, `SetSystemEnabled` |
| Settings | `GetSettings`, `UpdateSettings`, `ResetSettings`, `GetResolutionPresets`, `GetCustomResolutionLimits` |
| Files | `ListScreenshots`, `ListRecordings`, `RenameScreenshot`, `DeleteScreenshot`, `RenameRecording`, `DeleteRecording`, `SaveFileDialog`, `WriteFile`, `SelectDirectory` |
| Misc | `GetScreenshotsBaseURL`, `GetRecordingsBaseURL`, `GetAppVersion`, `GetHomeDir`, `OpenToolsPalette` |

Rules for this layer:

- Keep it as orchestration. If logic can be reused, it belongs in `services/`.
- Do not duplicate service functionality here.
- Only add an exported method when the frontend genuinely needs it.
- Logging goes through `runtime.LogInfo` / `runtime.LogError`.
- Concurrency uses `sync.Mutex` (see `overlayMu`, `serverMu`).

---

## Services

`services/` packages are **plain Go** and must never import
`github.com/wailsapp/wails/v2`. They are independently testable and are
covered by `tests/backend/services/<pkg>/`.

| Package | Responsibility |
| ------- | -------------- |
| `services/screenshot` | D-Bus Screenshot portal calls, file naming, region cropping |
| `services/screencast` | D-Bus ScreenCast portal, GStreamer pipeline, audio devices, thumbnails, output paths |
| `services/settings` | Settings structs, defaults, normalisation, atomic JSON persistence, resolution presets |
| `services/notification` | `org.freedesktop.Notifications` with an image attachment |

---

## Window modes

The top-level window is a union type managed in `frontend/src/App.tsx`:

```ts
type WindowMode =
  | "palette"
  | "studio"
  | "record"
  | "recording"
  | "settings"
  | "preferences"
  | "overlay"
  | "closed";
```

Switching modes calls the matching `ResizeTo*` method so the native window
follows the UI:

| Mode | Window size | Shown by |
| ---- | ----------- | -------- |
| `palette` | 520 × 100 | `Palette` |
| `studio` / `record` | maximised | `Studio`, `Record` |
| `settings` | 380 × 460 | `RecordingSettings` |
| `preferences` | 520 × 640 | `SettingsPanel` |
| `recording` | 520 × 100 | `RecordingBar` |
| `overlay` | fullscreen | `Overlay` (area selection) |

---

## Events

Backend → frontend communication uses `runtime.EventsEmit`:

| Event | Payload | Emitted when |
| ----- | ------- | ------------ |
| `recording-started` | – | The GStreamer process started writing the output file |
| `recording-ended` | – | The recording finished (also used to fire the desktop notification) |
| `thumbnail-ready` | `{ video, thumbnail }` | A background thumbnail finished generating |

The frontend subscribes with `EventsOn` from
`frontend/wailsjs/runtime/runtime`. The `toggle-palette` event is handled on
the frontend side but has no emitter in the backend today.

---

## The loopback HTTP server

`App.startup` starts an HTTP server bound to `127.0.0.1:0` (a random free
port). It serves two directories:

| Path | Directory |
| ---- | --------- |
| `/` | the screenshot save directory |
| `/recordings/` | the recording save directory |

The frontend learns the base URLs through `GetScreenshotsBaseURL()` and
`GetRecordingsBaseURL()` and loads images and videos from there. This keeps
large binary files out of the Wails JSON bridge.

`App.shutdown` stops the server with a 3-second timeout and cleans up the
recorder and the D-Bus connection. It is not registered as `OnShutdown` in
`main.go` yet, so it only runs if you wire it up.

---

## The area-selection flow

Area capture is a two-step, in-app workflow rather than a single portal call:

1. `StartPaletteAreaCapture()` captures the full screen through the portal and
   returns the URL of the temporary file.
2. The frontend switches to the `overlay` mode, shows the image fullscreen and
   lets the user drag a rectangle. `Overlay` converts screen coordinates into
   image pixels using the natural image size.
3. `CompletePaletteAreaScreenshot(x, y, width, height)` crops the pending file
   in place (`screenshot.Service.CropRegion`) and runs the post-capture steps.
4. `CancelPaletteAreaCapture()` deletes the temporary file.

The pending path is guarded by `overlayMu` so a cancel and a confirm can never
race.

---

## The settings system

Settings live in `services/settings` and are persisted as JSON at:

```
~/.config/glowsnap/settings.json
```

- `Load()` merges the stored file over the defaults, so a settings file written
  by an older version still loads.
- `normalize()` clamps and repairs values (delay 0–60 s, font size 4–200 px,
  stroke width 1–50, opacity 0–1, even custom resolutions inside 16×16 –
  3840×2160).
- `Save()` writes to `settings.json.tmp` and renames it — the write is atomic.
- Legacy keys (`recording.quality`, a top-level `microphone`) are migrated on
  load.

---

## The editor model

The editor is a Konva stage driven by the `ShapeConfig` model in
`frontend/src/types/types.ts`:

```ts
interface ShapeConfig {
  id: string;
  type: "rect" | "circle" | "arrow" | "text" | "line" | "pen";
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  stroke?: string; fill?: string;
  strokeWidth?: number; opacity?: number;
  fontSize?: number; fontFamily?: string; fontStyle?: string;
  points?: number[];      // free-hand / arrow geometry
  text?: string;
}
```

State lives in hooks under `frontend/src/lib/hooks/` (`useShapes`,
`useDrawing`, `useCrop`, `useTextEditing`, `useBackground`, `useHistory`) —
there is no global store.

---

## Rules of the road

1. `app.go` stays a bridge; reusable logic goes into `services/`.
2. `services/` never imports Wails.
3. `frontend/wailsjs/` is generated — change `app.go` and regenerate.
4. All tests live in `tests/`, never next to the source.
5. Linux-native integrations are intentional; do not replace them with
   cross-platform shims.
6. `./test.sh` is the only validation entry point.
