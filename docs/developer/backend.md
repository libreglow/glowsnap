# Backend

The backend is plain Go. Only `app.go` and `main.go` may import Wails;
everything under `services/` must stay framework-free so it can be unit tested
without a running desktop.

---

## `main.go`

```go
//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte
```

The window options:

| Option | Value | Why |
| ------ | ----- | --- |
| `Title` | `Glowsnap` | |
| `Width` / `Height` | 520 / 100 | The palette size; other modes resize at runtime |
| `Frameless` | `true` | The palette has no window decoration |
| `AlwaysOnTop` | `true` | The palette floats above other windows |
| `BackgroundColour` | `RGBA{0,0,0,0}` | A transparent background for the rounded palette |
| `Linux.WindowIsTranslucent` | `true` | Required for the transparent background |
| `Linux.WebviewGpuPolicy` | `Always` | Konva needs GPU acceleration for smooth canvas rendering |
| `Linux.ProgramName` | `glowsnap` | Sets the GTK prgname, used for the desktop entry and `StartupWMClass` |

`OnStartup` is wired to `app.startup`. `App.shutdown` implements the cleanup
(HTTP server, recorder, D-Bus connection) but is **not** currently registered as
`OnShutdown` in `main.go` — wire it up if you need deterministic teardown.

---

## `app.go` — the bridge

`App` holds the shared state:

```go
type App struct {
    ctx               context.Context
    dbusConn          *dbus.Conn
    screenshotService *screenshot.Service
    screenCastService *screencast.ScreenCastService
    httpServer        *http.Server
    screenshotsURL    string
    screenshotsDir    string
    recordingsURL     string
    recordingsDir     string
    serverMu          sync.Mutex
    overlayMu         sync.Mutex
    pendingOverlayPath string
}
```

### Startup sequence

`startup(ctx)` does four things:

1. Opens the session bus (`dbus.SessionBus()`) and stores the connection.
2. Creates the `screenshot` and `screencast` services and registers the
   `recording-started` / `recording-ended` callbacks.
3. Creates the screenshot and recording directories.
4. Starts the loopback HTTP server on `127.0.0.1:0` and stores the two base
   URLs.

### Capture flow

```go
func (a *App) TakeScreenshot() {
    cfg := settings.Load()
    if cfg.Screenshot.DelaySeconds > 0 { /* sleep */ }
    if cfg.Screenshot.HidePanelBeforeCapture {
        runtime.WindowHide(a.ctx)
        time.Sleep(panelHideDelay)   // 250ms
    }
    path, err := a.screenshotService.CaptureFullScreen()
    if hidden { runtime.WindowShow(a.ctx) }
    a.postProcessCapture(path, "Screenshot", cfg)
}
```

`postProcessCapture` is the shared tail of every capture:

| Setting | Effect |
| ------- | ------ |
| `CopyToClipboard` | Pipes the PNG into `wl-copy`, `xclip` or `xsel` (first one found) |
| `OpenAfterCapture` | Runs `xdg-open <path>` |
| `NotifyOnCapture` | Sends a desktop notification with the capture attached |

### Area capture (two steps)

`StartPaletteAreaCapture()` → `CompletePaletteAreaScreenshot(x, y, w, h)` →
`CancelPaletteAreaCapture()`. See
[Architecture → The area-selection flow](./architecture.md#the-area-selection-flow).

### The loopback HTTP server

```go
mux.Handle("/",         fileServer(a.screenshotsDir))
mux.Handle("/recordings/", fileServer(a.recordingsDir))
```

Both handlers set `Access-Control-Allow-Origin: *` because the WebKit view
loads them from a different origin than the app itself.

---

## `services/screenshot`

### Portal call

```text
Bus name : org.freedesktop.portal.Desktop
Object   : /org/freedesktop/portal/desktop
Method   : org.freedesktop.portal.Screenshot.Screenshot
Args     : parent_window "", options a{sv}
Returns  : o (request handle)
```

Options:

| Option | Value |
| ------ | ----- |
| `handle_token` | `glowsnap_<unix nanos>` |
| `interactive` | `false` for full screen, `true` for a portal-driven area selection |
| `include_cursor` | `settings.Screenshot.ShowMouseByDefault` |

The result arrives asynchronously on the portal's `Request` signal:

```text
type='signal',interface='org.freedesktop.portal.Request',member='Response',path='<handle>'
```

The body is `(uint32 response, map[string]dbus.Variant results)`:

| Response | Meaning |
| -------- | ------- |
| `0` | Success — the `uri` result holds a `file://` URI |
| `1` | The user cancelled |
| other | `portal rejected the request with code <n>` |

The request times out after 30 seconds.

### File naming

```go
ts := time.Now().Format("2006-01-02_15-04-05")
name := strings.ReplaceAll(pattern, "{date}", ts)
```

Illegal file-name characters (`/ \ : * ? " < > |`) are replaced with `_`, and
an empty result falls back to `screenshot_<timestamp>`. The file is always
written as `.png` in the configured save directory; the portal's temporary file
is moved with `os.Rename`, falling back to a copy across filesystems.

### Cropping

`CropRegion(path, x, y, width, height)` decodes the image, intersects the
requested rectangle with the image bounds (so an out-of-bounds crop is clipped
rather than failing) and re-encodes the result as PNG over the same file.

---

## `services/screencast`

### Portal session

```text
CreateSession   -> o (request handle)   -> results["session_handle"]
SelectSources   -> o (request handle)   -> results["streams"]
Start           -> o (request handle)   -> results["streams"]
```

Options:

| Call | Options |
| ---- | ------- |
| `CreateSession` | `handle_token`, `session_handle_token`, `persist_mode: 2` (persistent) |
| `SelectSources` | `handle_token`, `types: 1|2` (monitor + window), `multiple: false`, optional `cursor_mode` |
| `Start` | `handle_token` |

Timeouts: 10 s for `CreateSession`, 30 s for `SelectSources`, 10 s for `Start`.

Cursor modes are read from the `AvailableCursorModes` property and mapped to
`1` (hidden) or `2` (embedded).

### The GStreamer pipeline

Built by `buildPipelineArgs`:

```text
gst-launch-1.0 -e
  pipewiresrc path=<videoNode>
  ! videoconvert
  ! videoscale add-borders=true
  ! video/x-raw,width=<W>,height=<H>
  ! videoconvert
  ! openh264enc bitrate=<b> complexity=<c> qp-min=<qmin> qp-max=<qmax> gop-size=60
  ! h264parse
  ! queue max-size-time=2000000000
  ! mp4mux name=mux
  ! filesink location=<OutputPath>
```

Audio is mixed in separately. With one source:

```text
pulsesrc device=<src> provide-clock=false
! queue max-size-time=2000000000 max-size-buffers=0 max-size-bytes=0 leaky=2
! audioconvert ! audioresample
! queue ...
! avenc_aac bitrate=<ab>
! aacparse
! queue ...
! mux.audio_0
```

With two sources (microphone first, system audio second) an `audiomixer` is
inserted:

```text
pulsesrc device=<mic> ... ! audioconvert ! audioresample ! audiomixer name=mix ...
pulsesrc device=<system> ... ! audioconvert ! audioresample ! mix.
```

Key details:

- `videoscale add-borders=true` letterboxes instead of distorting.
- `leaky=2` on the source queues keeps audio back-pressure from stalling
  video.
- The muxer request pad is `mux.audio_0`.

### Encoding profiles

Selected from the total pixel count:

| Size | Video bitrate | Audio bitrate | Complexity | qp-min | qp-max |
| ---- | ------------- | ------------- | ---------- | ------ | ------ |
| ≤ 854×480 | 800 kbit/s | 96 kbit/s | 0 | 32 | 48 |
| ≤ 1280×720 | 2 Mbit/s | 128 kbit/s | 1 | 24 | 44 |
| ≤ 1920×1080 | 6 Mbit/s | 192 kbit/s | 2 | 16 | 38 |
| ≤ 2560×1440 | 12 Mbit/s | 192 kbit/s | 2 | 16 | 38 |
| larger | 24 Mbit/s | 192 kbit/s | 2 | 16 | 38 |

`gop-size` is always `60`.

### Process control

| Action | Mechanism |
| ------ | --------- |
| Pause | `SIGSTOP` to the `gst-launch-1.0` child |
| Resume | `SIGCONT` |
| Stop | `SIGCONT` (if paused), a 100 ms pause, then `SIGINT` so GStreamer finalises the MP4; the process is killed after a 5 s timeout |
| Cancel | `SIGKILL`, then the partial file is removed |

### Audio devices (`audio.go`)

Everything goes through `pactl`:

| Function | Implementation |
| -------- | -------------- |
| `ListMicrophones()` | `pactl list sources`, filtered to sources that are not `.monitor` sources |
| `DefaultMicrophone()` | `pactl get-default-source`, falling back to the first non-monitor source |
| `SystemAudioDevice()` | `pactl get-default-sink` → `<sink>.monitor`, verified against the source list |
| `SetMicEnabled` / `SetSystemEnabled` | `pactl set-source-mute <source> 0|1` |

### Thumbnails (`thumbnail.go`)

```bash
ffmpeg -y -ss 1 -i <video> -frames:v 1 -vf scale=480:-1 -q:v 5 <thumb>.jpg
```

If seeking to 1 second fails, the file is removed and the command is retried
with `-ss 0`. Generation is asynchronous and de-duplicated through a package
level in-flight map; the frontend is notified with the `thumbnail-ready` event.

---

## `services/settings`

### Structs

```go
type Settings struct {
    General         General           `json:"general"`
    Screenshot      Screenshot        `json:"screenshot"`
    Recording       Recording         `json:"recording"`
    Editor          Editor            `json:"editor"`
    Advanced        Advanced          `json:"advanced"`
    Shortcuts       Shortcuts         `json:"shortcuts"`
    CustomShortcuts map[string]string `json:"customShortcuts"`
    Favorites       Favorites         `json:"favorites"`
}
```

### Persistence

| Operation | Behaviour |
| --------- | --------- |
| `Load()` | Reads the file, merges it over `Defaults()`, migrates legacy keys, normalises |
| `Save(s)` | Normalises, marshals with indentation, writes `settings.json.tmp`, renames it over `settings.json` |
| `ResetToDefaults()` | Removes the file and returns the defaults |

`mergeDefaults` checks which keys are actually present in the JSON so that a
setting the user explicitly set to `false` is not overwritten by the default.

### Normalisation

| Field | Rule |
| ----- | ---- |
| `screenshot.saveDir` / `recording.saveDir` | `~` expanded, made absolute |
| `screenshot.delaySeconds` | Clamped to 0–60 |
| `screenshot.filenamePattern` | Empty falls back to `screenshot_{date}` |
| `recording.resolution` | Invalid values fall back to `1080p` |
| `recording.customWidth` / `customHeight` | Must be even, 16–3840 / 16–2160 |
| `editor.defaultFontSize` | Clamped to 4–200 |
| `editor.defaultStrokeWidth` | Clamped to 1–50 |
| `editor.defaultOpacity` | Clamped to 0–1 |
| `customShortcuts` | Trimmed; `nil` becomes an empty map |

### Resolutions (`resolution.go`)

| Value | Label | Size |
| ----- | ----- | ---- |
| `360p` | 360p | 640 × 360 |
| `480p` | 480p | 854 × 480 |
| `720p` | 720p | 1280 × 720 |
| `1080p` | 1080p | 1920 × 1080 |
| `1440p` | 1440p | 2560 × 1440 |
| `2160p` | 2160p (4K) | 3840 × 2160 |
| `custom` | Custom | user defined |

Limits: 16×16 to 3840×2160, both dimensions even.

The legacy `recording.quality` key is mapped on load (`high` → `1080p`,
`medium` → `720p`, `low` → `480p`).

> **Shortcut storage:** the `shortcuts` group above holds the historical
> defaults (`Ctrl+Shift+S`, `Ctrl+Space`, …). The shortcuts the UI actually
> binds live in `frontend/src/lib/shortcut.ts`, and the user's rebindings are
> stored in the separate `customShortcuts` map, keyed by the shortcut id.

---

## `services/notification`

```text
Bus name : org.freedesktop.Notifications
Object   : /org/freedesktop/Notifications
Method   : org.freedesktop.Notifications.Notify
Args     : app_name, replaces_id, app_icon, summary, body, actions, hints, expire_timeout
```

Hints:

| Hint | Value |
| ---- | ----- |
| `image-path` | Absolute path of the capture |
| `image-data` | `(iiibiiay)` tuple: width, height, rowstride, has-alpha, bits-per-sample, channels, RGBA8 pixels |

The image is scaled so its longest side is at most 1024 px. If the image hints
make the call fail, the notification is retried without any hints so the text
still shows up.
